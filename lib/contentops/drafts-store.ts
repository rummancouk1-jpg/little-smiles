// Engine layer for the ContentOps drafts table. Pure typed read/write
// helpers — no auth, no UI, no project-specific knowledge. Reusable across
// any project that adopts the contentops_drafts schema.

import { type BlogPost } from "@/lib/contentops/blog-schema";
import { type CritiqueResult } from "@/lib/contentops/critique";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export type DraftStatus = "pending_review" | "approved" | "rejected" | "published";

/** One check that was failing at reject time — the structured "why" recorded
 *  alongside the free-text rejection_note. Feeds the drafting prompt's
 *  "avoid these failure modes" cautions (feed-forward learning signal). */
export type RejectionReasonCheck = {
  /** publish-score check key or validation badge key (e.g. "title_length", "thin_content"). */
  key: string;
  /** Short human-readable label. */
  label: string;
  /** The concrete detail at reject time (e.g. "75 chars (target 30-70)."). */
  detail: string;
};

export type RejectionReason = {
  /** The specific checks that were failing when the draft was rejected. */
  failedChecks: RejectionReasonCheck[];
  /** The publish-score at reject time, for coarse context. */
  score: number;
  capturedAt: string;
};

export type Draft = {
  id: string;
  slug: string;
  status: DraftStatus;
  content: BlogPost;
  /** Opus critique-pass flags for the reviewer (null until generated/stored). */
  critique: CritiqueResult | null;
  /**
   * Optional reviewer-selected hero image path (e.g. "/products/foo.jpg").
   * Always a path under /public — never an absolute URL. When null, the
   * blog-publish flow falls back to getBlogAnchorProduct(post).image.
   */
  hero_image_path: string | null;
  rejection_note: string | null;
  /** Structured reason (which checks failed) recorded at reject time. Null for
   *  drafts rejected before this column existed, or never rejected. */
  rejection_reason: RejectionReason | null;
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

/**
 * Flip an approved draft to published (H1 fix — the status is finally
 * written back). `content` is the fully-resolved BlogPost the public blog
 * will serve (hero override merged, publishedAt stamped to publish day,
 * readTime recomputed) — stored back onto the row so the draft record IS
 * the published record.
 */
export async function markDraftPublished(id: string, content: BlogPost): Promise<Draft> {
  const supabase = requireClient();
  const existing = await getDraftById(id);
  if (!existing) {
    throw new Error("Draft not found.");
  }
  if (existing.status !== "approved") {
    throw new Error(`Only approved drafts can be published (draft is ${existing.status}).`);
  }
  const now = new Date().toISOString();
  const payload = {
    status: "published",
    content,
    slug: content.slug,
    published_at: now,
    updated_at: now,
  };
  const { data, error } = await supabase
    .from("contentops_drafts")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(payload as any)
    .eq("id", id)
    .eq("status", "approved") // guard against a concurrent publish
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`Failed to mark draft published: ${error?.message ?? "draft not found"}`);
  }
  return data as Draft;
}

export async function rejectDraft(
  id: string,
  note?: string,
  reason?: RejectionReason | null,
): Promise<Draft> {
  const supabase = requireClient();
  const now = new Date().toISOString();
  const trimmed = note?.trim();
  const basePayload = {
    status: "rejected" as const,
    rejection_note: trimmed && trimmed.length > 0 ? trimmed.slice(0, 2000) : null,
    updated_at: now,
  };
  // Try WITH the structured reason; if the column hasn't been migrated yet
  // (PGRST204), fall back to updating without it — mirrors the critique-column
  // pattern in insertDraft so an un-migrated DB still rejects cleanly.
  let { data, error } = await supabase
    .from("contentops_drafts")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ ...basePayload, rejection_reason: reason ?? null } as any)
    .eq("id", id)
    .select("*")
    .single();
  const columnMissing =
    error?.code === "PGRST204" || /rejection_reason.*column|schema cache/i.test(error?.message ?? "");
  if (error && columnMissing) {
    ({ data, error } = await supabase
      .from("contentops_drafts")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(basePayload as any)
      .eq("id", id)
      .select("*")
      .single());
  }
  if (error || !data) {
    throw new Error(`Failed to reject draft: ${error?.message ?? "draft not found"}`);
  }
  return data as Draft;
}

/**
 * The OPERATOR QUEUE slice: drafts that still need operator action —
 * pending_review (needs approve/reject) + approved (needs the publish click).
 * rejected (machine-final) and published (done, on their own page) are
 * deliberately excluded so the queue only shows things awaiting a human.
 */
export async function listOperatorQueueDrafts(): Promise<Draft[]> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from("contentops_drafts")
    .select("*")
    .in("status", ["pending_review", "approved"])
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) {
    throw new Error(`Failed to list operator-queue drafts: ${error.message}`);
  }
  return (data ?? []) as Draft[];
}

/**
 * Recent rejection reasons for the drafting feed-forward signal — the last few
 * rejected drafts' structured reasons + notes, so generation can caution the
 * model to avoid known failure modes. Read separately from loadCorpus ON
 * PURPOSE: rejected drafts must never enter the positive corpus (we don't link
 * to or seed from them), only their failure reasons feed forward. Never throws.
 */
export async function listRecentRejectionReasons(
  limit = 8,
): Promise<{ slug: string; title: string; note: string | null; reason: RejectionReason | null }[]> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("contentops_drafts")
    .select("slug, content, rejection_note, rejection_reason, updated_at")
    .eq("status", "rejected")
    .order("updated_at", { ascending: false })
    .limit(Math.max(1, Math.min(limit, 25)));
  if (error || !data) return [];
  return (data as { slug: string; content: BlogPost; rejection_note: string | null; rejection_reason: RejectionReason | null }[]).map(
    (row) => ({
      slug: row.slug,
      title: row.content?.title ?? row.slug,
      note: row.rejection_note ?? null,
      reason: row.rejection_reason ?? null,
    }),
  );
}
