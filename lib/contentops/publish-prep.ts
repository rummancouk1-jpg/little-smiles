// Pure engine for the publish-preparation pipeline. Reads only, no
// mutations. The orchestrator `preparePublish` composes validation,
// conflict detection, and adapter-driven preview into a single report
// the wiring layer renders.

import { blogPostSchema, type BlogPost } from "@/lib/contentops/blog-schema";
import { listDrafts, type Draft } from "@/lib/contentops/drafts-store";
import type {
  Conflict,
  PublishAdapter,
  PublishPreparation,
  ValidationReport,
} from "@/lib/contentops/publish-types";

const TITLE_MIN_LENGTH = 30;
const TITLE_MAX_LENGTH = 70;
const DESCRIPTION_MIN_LENGTH = 80;
const DESCRIPTION_MAX_LENGTH = 160;
const CTA_HREF_PATTERN = /^\/shop\?category=.+$/;

export function validateDraftSchema(draft: Draft): ValidationReport {
  const result = blogPostSchema.safeParse(draft.content);
  if (result.success) {
    return { schemaValid: true, schemaErrors: [] };
  }
  const errors = result.error.issues.map((issue) => {
    const path = issue.path.join(".");
    return path ? `${path}: ${issue.message}` : issue.message;
  });
  return { schemaValid: false, schemaErrors: errors };
}

export async function detectConflicts(
  draft: Draft,
  adapter: PublishAdapter,
  insertionPreview: BlogPost,
): Promise<Conflict[]> {
  const conflicts: Conflict[] = [];

  // External: posts already published in the project's target.
  const existingPosts = await adapter.listExistingPostMetadata();

  // Engine-internal: other drafts in contentops_drafts that could collide.
  const [approvedDrafts, publishedDrafts] = await Promise.all([
    listDrafts("approved"),
    listDrafts("published"),
  ]);
  const otherDrafts = [...approvedDrafts, ...publishedDrafts].filter(
    (d) => d.id !== draft.id,
  );

  if (existingPosts.some((p) => p.slug === draft.slug)) {
    conflicts.push({
      code: "SLUG_DUPLICATES_PUBLISHED",
      severity: "error",
      message: `Slug "${draft.slug}" already exists in published posts.`,
      hint: "Edit the draft to use a different slug, or treat this as a re-publish (out of scope for Phase 2).",
    });
  }

  const draftSlugMatches = otherDrafts.filter((d) => d.slug === draft.slug);
  if (draftSlugMatches.length > 0) {
    conflicts.push({
      code: "SLUG_DUPLICATES_OTHER_DRAFT",
      severity: "warning",
      message: `Slug "${draft.slug}" matches ${draftSlugMatches.length} other draft(s) (approved or published).`,
      hint: `Conflicting draft id(s): ${draftSlugMatches.map((d) => d.id).join(", ")}.`,
    });
  }

  if (existingPosts.some((p) => p.title === draft.content.title)) {
    conflicts.push({
      code: "TITLE_DUPLICATES_PUBLISHED",
      severity: "warning",
      message: "Title exactly matches an existing published post.",
      hint: "Confirm this is intentional or rephrase the title.",
    });
  }

  const imageReport = adapter.reportImageAvailability(insertionPreview);
  if (!imageReport.ok) {
    conflicts.push({
      code: "CATEGORY_NO_PRODUCTS",
      severity: "warning",
      message: imageReport.reason ?? "No anchor product available for this category.",
      hint: "Blog will render without a hero image until a product is added in this category.",
    });
  }

  const ctaHref = draft.content.cta.href;
  if (!CTA_HREF_PATTERN.test(ctaHref)) {
    conflicts.push({
      code: "CTA_HREF_MALFORMED",
      severity: "warning",
      message: `CTA href "${ctaHref}" does not match the expected /shop?category=... pattern.`,
      hint: "Confirm the CTA link is intentional or correct it before publishing.",
    });
  }

  const titleLen = draft.content.title.length;
  if (titleLen < TITLE_MIN_LENGTH || titleLen > TITLE_MAX_LENGTH) {
    conflicts.push({
      code: "METADATA_TITLE_LENGTH",
      severity: "warning",
      message: `Title length is ${titleLen} characters (recommended ${TITLE_MIN_LENGTH}-${TITLE_MAX_LENGTH}).`,
      hint:
        titleLen < TITLE_MIN_LENGTH
          ? "Title may be too short for SEO impact."
          : "Title may be truncated in Google search results.",
    });
  }

  const descLen = draft.content.description.length;
  if (descLen < DESCRIPTION_MIN_LENGTH || descLen > DESCRIPTION_MAX_LENGTH) {
    conflicts.push({
      code: "METADATA_DESCRIPTION_LENGTH",
      severity: "warning",
      message: `Description length is ${descLen} characters (recommended ${DESCRIPTION_MIN_LENGTH}-${DESCRIPTION_MAX_LENGTH}).`,
      hint:
        descLen < DESCRIPTION_MIN_LENGTH
          ? "Description may be too short for meta description."
          : "Description may be truncated in Google search results.",
    });
  }

  return conflicts;
}

export async function preparePublish(
  draft: Draft,
  adapter: PublishAdapter,
): Promise<PublishPreparation> {
  const preparedAt = new Date().toISOString();
  const validation = validateDraftSchema(draft);

  if (!validation.schemaValid) {
    return {
      draft,
      validation,
      conflicts: [
        {
          code: "SCHEMA_INVALID",
          severity: "error",
          message: "Draft content does not match the BlogPost schema.",
          hint: validation.schemaErrors.join("; "),
        },
      ],
      insertionPreview: draft.content,
      diffText: "// Cannot generate diff: schema validation failed.",
      ready: false,
      preparedAt,
    };
  }

  const insertionPreview = adapter.buildInsertionObject(draft);
  const conflicts = await detectConflicts(draft, adapter, insertionPreview);
  const diffText = adapter.buildDiffText(insertionPreview);
  const ready = conflicts.every((c) => c.severity !== "error");

  return {
    draft,
    validation,
    conflicts,
    insertionPreview,
    diffText,
    ready,
    preparedAt,
  };
}
