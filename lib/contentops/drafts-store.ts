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
  /**
   * Optional reviewer-selected hero image path (e.g. "/products/foo.jpg").
   * Always a path under /public — never an absolute URL. When null, the
   * blog-publish flow falls back to getBlogAnchorProduct(post).image.
   */
  hero_image_path: string | null;
  rejection_note: string | null;
  approved_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

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

export type DraftStatusCounts = Record<DraftStatus, number> & { all: number };

const EMPTY_COUNTS: DraftStatusCounts = {
  all: 0,
  pending_review: 0,
  approved: 0,
  rejected: 0,
  published: 0,
};

/**
 * Count drafts grouped by status, server-side. Used by the queue to drive
 * filter pill badges that stay stable while a status filter is applied —
 * counts must reflect the whole table, not the currently-visible slice.
 */
export async function countDraftsByStatus(): Promise<DraftStatusCounts> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return { ...EMPTY_COUNTS };
  const { data, error } = await supabase
    .from("contentops_drafts")
    .select("status")
    .limit(10_000);
  if (error || !data) return { ...EMPTY_COUNTS };
  const counts: DraftStatusCounts = { ...EMPTY_COUNTS };
  for (const row of data as { status: DraftStatus }[]) {
    if (row.status in counts) {
      counts[row.status]++;
      counts.all++;
    }
  }
  return counts;
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

/**
 * Look up the most recent draft whose `slug` matches the given value.
 * Used by the SEO Intelligence dashboard to deep-link a blog diagnostic
 * back to its draft. Returns `null` when no draft exists or Supabase is
 * not configured (caller decides whether that is fatal).
 */
export async function findDraftBySlug(slug: string): Promise<Draft | null> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("contentops_drafts")
    .select("*")
    .eq("slug", slug)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    return null;
  }
  return (data as Draft | null) ?? null;
}

/** Map every distinct slug in contentops_drafts to its most recent draft id. */
export async function listDraftSlugIndex(): Promise<Map<string, { id: string; status: DraftStatus }>> {
  const supabase = getSupabaseAdminClient();
  const out = new Map<string, { id: string; status: DraftStatus }>();
  if (!supabase) return out;
  const { data, error } = await supabase
    .from("contentops_drafts")
    .select("id, slug, status, created_at")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error || !data) return out;
  for (const row of data as { id: string; slug: string; status: DraftStatus }[]) {
    if (!out.has(row.slug)) {
      out.set(row.slug, { id: row.id, status: row.status });
    }
  }
  return out;
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

/**
 * Persist a reviewer's choice of hero image path. Pass `null` to clear the
 * override and fall back to the auto-resolved anchor product image. Path
 * must be relative to /public (e.g. "/products/foo.jpg"); callers must
 * validate before invoking — this helper does not sanitize.
 */
export async function updateDraftHeroImage(id: string, heroImagePath: string | null): Promise<Draft> {
  const supabase = requireClient();
  const now = new Date().toISOString();
  // supabase-js infers `never` for table updates when no Database type
  // is supplied. Build the payload then cast at the call site so the
  // PostgREST runtime still receives the null value for the nullable column.
  const payload = { hero_image_path: heroImagePath, updated_at: now };
  const { data, error } = await supabase
    .from("contentops_drafts")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(payload as any)
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`Failed to update hero image: ${error?.message ?? "draft not found"}`);
  }
  return data as Draft;
}

/**
 * Replace a draft's content (and mirrored slug column) in place. The
 * reviewer's highest-leverage tool: fix a title/section/CTA without the
 * reject-and-regenerate dead end.
 *
 * Status rules:
 * - pending_review / approved: content updates, status unchanged (the same
 *   human is the approval gate — a fix does not demote an approved draft).
 * - rejected: editing REVIVES the draft back to pending_review and clears
 *   the rejection note (the note described content that no longer exists).
 * - published: refused — published posts are edited via a future re-publish
 *   flow, not silently mutated.
 *
 * Callers must validate `content` against blogPostSchema before invoking.
 */
export async function updateDraftContent(id: string, content: BlogPost): Promise<Draft> {
  const supabase = requireClient();
  const existing = await getDraftById(id);
  if (!existing) {
    throw new Error("Draft not found.");
  }
  if (existing.status === "published") {
    throw new Error("Published drafts cannot be edited.");
  }
  const now = new Date().toISOString();
  const revive = existing.status === "rejected";
  const payload = {
    content,
    slug: content.slug,
    updated_at: now,
    ...(revive ? { status: "pending_review", rejection_note: null } : {}),
  };
  const { data, error } = await supabase
    .from("contentops_drafts")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(payload as any)
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`Failed to update draft: ${error?.message ?? "draft not found"}`);
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
