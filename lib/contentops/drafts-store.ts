// Engine layer for the ContentOps drafts table. Pure typed read/write
// helpers — no auth, no UI, no project-specific knowledge. Reusable across
// any project that adopts the contentops_drafts schema.

import { type BlogPost } from "@/lib/contentops/blog-schema";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export type DraftStatus = "pending_review" | "approved" | "rejected" | "published";

export type Draft = {
  id: string;
  slug: string;
  status: DraftStatus;
  content: BlogPost;
  rejection_note: string | null;
  publish_notes: string | null;
  approved_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

const PUBLISH_NOTES_MAX_LENGTH = 2000;

export const DRAFT_STATUSES: DraftStatus[] = [
  "pending_review",
  "approved",
  "rejected",
  "published",
];

export function isDraftStatus(value: string): value is DraftStatus {
  return (DRAFT_STATUSES as string[]).includes(value);
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

// Closes the publish loop: a human has pasted the diff into lib/blog.ts and
// shipped it. Source-state guard is enforced at the SQL layer so concurrent
// clicks cannot double-publish, and so re-publishing a rejected or
// already-published draft is impossible. Full transition centralization
// lands in Commit F; this guard exists in D because publish is the new path.
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
    .eq("status", "approved")
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `Failed to mark draft published: ${error?.message ?? "draft not in approved state"}`,
    );
  }
  return data as Draft;
}
