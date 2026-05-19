// Engine layer for the ContentOps drafts table. Pure typed read/write
// helpers — no auth, no UI, no project-specific knowledge. Reusable across
// any project that adopts the contentops_drafts schema.

import { type BlogPost } from "@/lib/contentops/blog-schema";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export type DraftStatus =
  | "pending_review"
  | "approved"
  | "rejected"
  | "published"
  | "scheduled";

export type Draft = {
  id: string;
  slug: string;
  status: DraftStatus;
  content: BlogPost;
  rejection_note: string | null;
  publish_notes: string | null;
  approved_at: string | null;
  published_at: string | null;
  scheduled_at: string | null;
  created_at: string;
  updated_at: string;
};

const PUBLISH_NOTES_MAX_LENGTH = 2000;

/**
 * Statuses currently surfaced in reviewer queue filter pills. The
 * "scheduled" status exists in the engine union (Commit K added DB
 * + type support) but does not yet appear as a filter — Commit M
 * wires the scheduling UX and will expand this list.
 */
export const DRAFT_STATUSES: DraftStatus[] = [
  "pending_review",
  "approved",
  "rejected",
  "published",
];

/**
 * Exhaustive status list used for URL-param type guards. Includes
 * statuses not yet shown in pills so query strings (e.g. ?status=scheduled)
 * still type-check correctly while features are being wired in.
 */
export const ALL_DRAFT_STATUSES: DraftStatus[] = [
  ...DRAFT_STATUSES,
  "scheduled",
];

export function isDraftStatus(value: string): value is DraftStatus {
  return (ALL_DRAFT_STATUSES as string[]).includes(value);
}

function requireClient() {
  const client = getSupabaseAdminClient();
  if (!client) {
    throw new Error("Supabase admin client is not configured.");
  }
  return client;
}

export async function listDrafts(status?: DraftStatus): Promise<Draft[]> {
  const supabase = requireClient();
  let query = supabase
    .from("contentops_drafts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (status) {
    query = query.eq("status", status);
  }
  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to list drafts: ${error.message}`);
  }
  return (data ?? []) as Draft[];
}

export async function getDraftById(id: string): Promise<Draft | null> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from("contentops_drafts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to fetch draft: ${error.message}`);
  }
  return (data as Draft | null) ?? null;
}

export async function approveDraft(id: string): Promise<Draft> {
  const supabase = requireClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("contentops_drafts")
    .update({
      status: "approved",
      approved_at: now,
      updated_at: now,
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`Failed to approve draft: ${error?.message ?? "draft not found"}`);
  }
  return data as Draft;
}

export async function rejectDraft(id: string, note?: string): Promise<Draft> {
  const supabase = requireClient();
  const now = new Date().toISOString();
  const trimmed = note?.trim();
  const { data, error } = await supabase
    .from("contentops_drafts")
    .update({
      status: "rejected",
      rejection_note: trimmed && trimmed.length > 0 ? trimmed.slice(0, 2000) : null,
      updated_at: now,
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`Failed to reject draft: ${error?.message ?? "draft not found"}`);
  }
  return data as Draft;
}

// Closes the publish loop. Source-state guard enforced at the SQL layer so
// concurrent clicks cannot double-publish and re-publishing a rejected or
// already-published draft is impossible.
//
// Commit M broadens the source-state set to include 'scheduled' — the cron
// sweep (app/api/cron/contentops-publish-due) uses this path, and an
// operator can also override a scheduled draft by clicking Publish now.
export async function markDraftPublished(id: string, notes?: string): Promise<Draft> {
  const supabase = requireClient();
  const now = new Date().toISOString();
  const trimmed = notes?.trim();
  const normalizedNotes =
    trimmed && trimmed.length > 0 ? trimmed.slice(0, PUBLISH_NOTES_MAX_LENGTH) : null;

  const { data, error } = await supabase
    .from("contentops_drafts")
    .update({
      status: "published",
      published_at: now,
      publish_notes: normalizedNotes,
      updated_at: now,
    })
    .eq("id", id)
    .in("status", ["approved", "scheduled"])
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `Failed to mark draft published: ${error?.message ?? "draft not in approved or scheduled state"}`,
    );
  }
  return data as Draft;
}

// Schedule an approved (or already scheduled — i.e., reschedule) draft to
// publish at a specific time. The cron sweep at
// app/api/cron/contentops-publish-due flips due rows to 'published' and
// triggers revalidation.
//
// Source-state guard at SQL level: only ('approved', 'scheduled') rows
// can transition to 'scheduled'. Validation of scheduledAt-must-be-future
// lives at the API layer, not here, so the engine stays purely transactional.
export async function markDraftScheduled(
  id: string,
  scheduledAt: string,
  notes?: string,
): Promise<Draft> {
  const supabase = requireClient();
  const now = new Date().toISOString();
  const trimmed = notes?.trim();
  const normalizedNotes =
    trimmed && trimmed.length > 0 ? trimmed.slice(0, PUBLISH_NOTES_MAX_LENGTH) : null;

  const { data, error } = await supabase
    .from("contentops_drafts")
    .update({
      status: "scheduled",
      scheduled_at: scheduledAt,
      publish_notes: normalizedNotes,
      updated_at: now,
    })
    .eq("id", id)
    .in("status", ["approved", "scheduled"])
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `Failed to schedule draft: ${error?.message ?? "draft not in approved or scheduled state"}`,
    );
  }
  return data as Draft;
}

// Reverse a schedule. Returns the draft to 'approved' state and clears
// scheduled_at. Source-state guard: only 'scheduled' rows can move back
// to 'approved' through this path.
export async function markDraftUnscheduled(id: string): Promise<Draft> {
  const supabase = requireClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("contentops_drafts")
    .update({
      status: "approved",
      scheduled_at: null,
      updated_at: now,
    })
    .eq("id", id)
    .eq("status", "scheduled")
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `Failed to unschedule draft: ${error?.message ?? "draft not in scheduled state"}`,
    );
  }
  return data as Draft;
}

// Cron-facing list helper. Returns drafts whose scheduled_at has passed,
// regardless of how far in the past. Bounded by a generous limit so a
// huge backlog can't OOM the sweep; remaining rows pick up on the next
// cron tick.
export async function listScheduledDue(nowIso: string, limit = 50): Promise<Draft[]> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from("contentops_drafts")
    .select("*")
    .eq("status", "scheduled")
    .lte("scheduled_at", nowIso)
    .order("scheduled_at", { ascending: true })
    .limit(limit);
  if (error) {
    throw new Error(`Failed to list due scheduled drafts: ${error.message}`);
  }
  return (data ?? []) as Draft[];
}
