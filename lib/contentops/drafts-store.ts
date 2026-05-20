// Engine layer for the ContentOps drafts table. Pure typed read/write
// helpers — no auth, no UI, no project-specific knowledge. Reusable across
// any project that adopts the contentops_drafts schema.

import {
  blogPostSchema,
  type BlogImage,
  type BlogImageSlot,
  type BlogPost,
} from "@/lib/contentops/blog-schema";
import { describeMissingTable } from "@/lib/contentops/supabase-error-copy";
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
  manually_edited: boolean;
  last_edited_at: string | null;
  ai_generated_content: BlogPost | null;
  previous_content: BlogPost | null;
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

// Active-status set used by slug conflict checks. Matches the partial
// unique index defined in supabase/contentops-schema.sql.
const ACTIVE_DRAFT_STATUSES: DraftStatus[] = [
  "pending_review",
  "approved",
  "scheduled",
];

/**
 * Inserts a brand-new draft at status='pending_review'. Used by both the
 * CLI draft generator and the in-app draft creation API. Performs the
 * active-slug uniqueness pre-check inline so the caller doesn't need to
 * duplicate it.
 *
 * Throws a clear, single-string message on collision so the API can
 * surface it directly to the operator without parsing internals.
 */
export async function insertPendingReviewDraft(
  content: BlogPost,
): Promise<{ id: string; slug: string }> {
  const supabase = requireClient();

  const { data: existing, error: checkErr } = await supabase
    .from("contentops_drafts")
    .select("id, status")
    .eq("slug", content.slug)
    .in("status", ACTIVE_DRAFT_STATUSES)
    .limit(1);
  if (checkErr) {
    throw new Error(`Slug uniqueness check failed: ${checkErr.message}`);
  }
  const collision = existing?.[0];
  if (collision) {
    throw new Error(
      `Slug "${content.slug}" already has an active draft ` +
        `(id=${collision.id}, status=${collision.status}). ` +
        "Reject or publish it before generating again.",
    );
  }

  const { data, error } = await supabase
    .from("contentops_drafts")
    .insert({
      slug: content.slug,
      status: "pending_review",
      content,
      rejection_note: null,
      publish_notes: null,
      approved_at: null,
      published_at: null,
      scheduled_at: null,
      manually_edited: false,
      last_edited_at: null,
      // Commit Z: capture the original AI output once. Operator can
      // always restore to this regardless of how many edits have
      // happened since.
      ai_generated_content: content,
      previous_content: null,
    })
    .select("id, slug")
    .single();
  if (error || !data) {
    throw new Error(`Draft insert failed: ${error?.message ?? "no row returned"}`);
  }
  return { id: data.id, slug: data.slug };
}

// --- Edit-in-place helpers (Commit X) -----------------------------------

type EditableContentPatch = Partial<
  Pick<
    BlogPost,
    | "title"
    | "description"
    | "category"
    | "relatedProductCategory"
    | "publishedAt"
    | "readTime"
    | "keywords"
    | "sections"
    | "cta"
  >
>;

const EDITABLE_TOP_LEVEL_FIELDS: Array<keyof EditableContentPatch> = [
  "title",
  "description",
  "category",
  "relatedProductCategory",
  "publishedAt",
  "readTime",
  "keywords",
  "sections",
  "cta",
];

/**
 * Operator content edit. Merges a partial BlogPost into the draft's
 * current content, validates the merged whole against the canonical
 * schema, and persists with revision flags set. Slug is deliberately
 * not editable through this path — changing it would break URL
 * semantics and the active-slug invariant maintained by the unique
 * index.
 *
 * Frozen on status='published'. Allowed on every other status so an
 * operator can refine an approved or even a scheduled draft up to the
 * moment it goes live.
 */
export async function editDraftContent(
  id: string,
  patch: EditableContentPatch,
): Promise<Draft> {
  const supabase = requireClient();

  const { data: current, error: readErr } = await supabase
    .from("contentops_drafts")
    .select("content, status")
    .eq("id", id)
    .maybeSingle();
  if (readErr) {
    throw new Error(`Failed to read draft: ${readErr.message}`);
  }
  if (!current) {
    throw new Error("Draft not found");
  }
  if (current.status === "published") {
    throw new Error("Cannot edit a published draft. Generate a new draft instead.");
  }

  const currentContent = current.content as BlogPost;
  // Only allow whitelisted fields through. Anything else (slug, hero,
  // thumbnail, etc.) is preserved from current.
  const merged: BlogPost = { ...currentContent };
  for (const key of EDITABLE_TOP_LEVEL_FIELDS) {
    if (key in patch && patch[key] !== undefined) {
      // Narrow assignment via typed-key copy.
      (merged as Record<string, unknown>)[key] = (patch as Record<string, unknown>)[key];
    }
  }

  // Defensive: re-validate the merged whole. If a partial field has the
  // wrong shape, surface schema errors directly to the operator.
  const parsed = blogPostSchema.safeParse(merged);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    throw new Error(`Edit would break the article schema: ${issues}`);
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("contentops_drafts")
    .update({
      content: parsed.data,
      manually_edited: true,
      last_edited_at: now,
      updated_at: now,
      // Commit Z: capture the pre-edit content as the single-step undo
      // target. Replaces the previous snapshot if one exists — this
      // is one-deep history by design.
      previous_content: currentContent,
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`Failed to save edit: ${error?.message ?? "no row returned"}`);
  }
  return data as Draft;
}

// --- Restore helpers (Commit Z) ----------------------------------------

function deepEqual(a: BlogPost, b: BlogPost): boolean {
  // Structured content — JSON stringify equality is sufficient and
  // robust for our shape (no functions, no circular refs).
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Restore the single-step previous version. Swaps content ↔
 * previous_content so the restore itself is undoable. Recomputes
 * manually_edited by comparing the restored content against the AI
 * snapshot.
 *
 * Frozen on status='published'. Throws if no previous snapshot exists.
 */
export async function restorePreviousVersion(id: string): Promise<Draft> {
  const supabase = requireClient();
  const { data: current, error: readErr } = await supabase
    .from("contentops_drafts")
    .select("content, previous_content, ai_generated_content, status")
    .eq("id", id)
    .maybeSingle();
  if (readErr) {
    throw new Error(`Failed to read draft: ${readErr.message}`);
  }
  if (!current) {
    throw new Error("Draft not found");
  }
  if (current.status === "published") {
    throw new Error("Cannot restore a published draft.");
  }
  if (!current.previous_content) {
    throw new Error("No previous version to restore.");
  }

  const restored = current.previous_content as BlogPost;
  const swappedOut = current.content as BlogPost;
  const ai = current.ai_generated_content as BlogPost | null;
  const stillEdited = ai ? !deepEqual(restored, ai) : true;
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("contentops_drafts")
    .update({
      content: restored,
      previous_content: swappedOut,
      manually_edited: stillEdited,
      last_edited_at: now,
      updated_at: now,
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`Failed to restore previous version: ${error?.message ?? "no row returned"}`);
  }
  return data as Draft;
}

/**
 * Restore the original AI-generated content. Current content moves to
 * previous_content so a single undo is still available. manually_edited
 * resets to false because the article is now identical to the AI
 * snapshot.
 *
 * Frozen on status='published'. Throws if no AI snapshot exists (drafts
 * created before Commit Z).
 */
export async function restoreAiVersion(id: string): Promise<Draft> {
  const supabase = requireClient();
  const { data: current, error: readErr } = await supabase
    .from("contentops_drafts")
    .select("content, ai_generated_content, status")
    .eq("id", id)
    .maybeSingle();
  if (readErr) {
    throw new Error(`Failed to read draft: ${readErr.message}`);
  }
  if (!current) {
    throw new Error("Draft not found");
  }
  if (current.status === "published") {
    throw new Error("Cannot restore a published draft.");
  }
  if (!current.ai_generated_content) {
    throw new Error("No original AI version stored for this draft.");
  }

  const restored = current.ai_generated_content as BlogPost;
  const swappedOut = current.content as BlogPost;
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("contentops_drafts")
    .update({
      content: restored,
      previous_content: swappedOut,
      manually_edited: false,
      last_edited_at: now,
      updated_at: now,
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`Failed to restore AI version: ${error?.message ?? "no row returned"}`);
  }
  return data as Draft;
}

/**
 * Image metadata edit — alt text and/or caption on hero or thumbnail.
 * Lets the operator refine accessibility/editorial captions without
 * re-uploading the blob.
 *
 * Frozen on status='published'. Returns the updated draft.
 */
export async function editDraftImageMetadata(
  draftId: string,
  slot: BlogImageSlot,
  patch: { altText?: string; caption?: string | null },
): Promise<Draft> {
  const supabase = requireClient();

  const { data: current, error: readErr } = await supabase
    .from("contentops_drafts")
    .select("content, status")
    .eq("id", draftId)
    .maybeSingle();
  if (readErr) {
    throw new Error(`Failed to read draft: ${readErr.message}`);
  }
  if (!current) {
    throw new Error("Draft not found");
  }
  if (current.status === "published") {
    throw new Error("Cannot modify images on a published draft.");
  }

  const content = current.content as BlogPost;
  const existing = content[slot] as BlogImage | undefined;
  if (!existing) {
    throw new Error(`No image attached at slot '${slot}'.`);
  }

  const nextAlt =
    patch.altText !== undefined ? patch.altText.trim() : existing.altText;
  if (!nextAlt || nextAlt.length === 0) {
    throw new Error("Alt text cannot be empty.");
  }
  if (nextAlt.length > 500) {
    throw new Error("Alt text too long (max 500 characters).");
  }

  let nextCaption: string | undefined = existing.caption;
  if ("caption" in patch) {
    const trimmed = patch.caption?.trim() ?? "";
    nextCaption = trimmed.length > 0 ? trimmed.slice(0, 500) : undefined;
  }

  const updatedImage: BlogImage = {
    ...existing,
    altText: nextAlt,
    ...(nextCaption !== undefined ? { caption: nextCaption } : {}),
  };
  // Explicitly remove caption when set to empty so it doesn't linger.
  if (nextCaption === undefined) {
    delete (updatedImage as { caption?: string }).caption;
  }

  const nextContent: BlogPost = { ...content, [slot]: updatedImage };
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("contentops_drafts")
    .update({
      content: nextContent,
      manually_edited: true,
      last_edited_at: now,
      updated_at: now,
    })
    .eq("id", draftId)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`Failed to save image metadata: ${error?.message ?? "no row returned"}`);
  }
  return data as Draft;
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
    const friendly = describeMissingTable(error, "contentops_drafts");
    if (friendly) throw new Error(friendly);
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
    const friendly = describeMissingTable(error, "contentops_drafts");
    if (friendly) throw new Error(friendly);
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

// Attach a BlogImage to a slot on the draft's content. Reads the current
// content, writes the slot, and persists atomically. Published drafts are
// frozen — attempting to modify them throws so the operator can't
// accidentally edit a live article through the admin API.
//
// Commit N supports hero + thumbnail. The schema is ready for per-section
// images; routing them through here would require a richer slot type.
export async function attachDraftImage(
  draftId: string,
  slot: BlogImageSlot,
  image: BlogImage,
): Promise<Draft> {
  const supabase = requireClient();
  const { data: current, error: readErr } = await supabase
    .from("contentops_drafts")
    .select("content, status")
    .eq("id", draftId)
    .maybeSingle();
  if (readErr) {
    throw new Error(`Failed to read draft: ${readErr.message}`);
  }
  if (!current) {
    throw new Error("Draft not found");
  }
  if (current.status === "published") {
    throw new Error("Cannot modify images on a published draft");
  }

  const existing = current.content as BlogPost;
  const updatedContent: BlogPost = { ...existing, [slot]: image };
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("contentops_drafts")
    .update({ content: updatedContent, updated_at: now })
    .eq("id", draftId)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`Failed to attach image: ${error?.message ?? "no row updated"}`);
  }
  return data as Draft;
}

// Detach an image from a slot. Returns the removed image so the API
// route can delete its blob from storage. Detaching a slot that has no
// image is a no-op — returns the current draft and null.
export async function detachDraftImage(
  draftId: string,
  slot: BlogImageSlot,
): Promise<{ draft: Draft; removedImage: BlogImage | null }> {
  const supabase = requireClient();
  const { data: current, error: readErr } = await supabase
    .from("contentops_drafts")
    .select("content, status")
    .eq("id", draftId)
    .maybeSingle();
  if (readErr) {
    throw new Error(`Failed to read draft: ${readErr.message}`);
  }
  if (!current) {
    throw new Error("Draft not found");
  }
  if (current.status === "published") {
    throw new Error("Cannot modify images on a published draft");
  }

  const existing = current.content as BlogPost;
  const removedImage = (existing[slot] as BlogImage | undefined) ?? null;

  // Use object-rest pattern to omit the slot key cleanly.
  const updatedContent: BlogPost = { ...existing };
  delete (updatedContent as Record<string, unknown>)[slot];
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("contentops_drafts")
    .update({ content: updatedContent, updated_at: now })
    .eq("id", draftId)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`Failed to detach image: ${error?.message ?? "no row updated"}`);
  }
  return { draft: data as Draft, removedImage };
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
