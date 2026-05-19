// Pure function that computes a PublishingReadiness from the lower-level
// engine outputs (conflicts + schema validation + draft state). Engine
// code only — no UI, no project-specific imports.
//
// Design intent:
//   - Additive: the engine still emits Conflict[] and a boolean `ready`;
//     readiness is the operator-facing aggregation on top.
//   - Non-blocking by default for media: missing hero is a warning,
//     never blocked. Text-only articles remain publishable.
//   - Schema-invalid short-circuit: if the underlying content shape
//     can't be trusted, downstream facets are marked not_applicable and
//     the operator is steered toward fixing content first.

import type { BlogImage, BlogPost } from "@/lib/contentops/blog-schema";
import type { Draft } from "@/lib/contentops/drafts-store";
import type {
  Conflict,
  ConflictCode,
  FacetState,
  PublishingReadiness,
  ReadinessCheck,
  ReadinessFacet,
  ReadinessLevel,
  ValidationReport,
} from "@/lib/contentops/publish-types";

const FACET_LABELS: Record<ReadinessFacet, string> = {
  content: "Content",
  images: "Images",
  seo: "SEO",
  cta: "Call-to-action",
  metadata: "Metadata",
  channels: "Channels",
};

function findConflict(conflicts: Conflict[], code: ConflictCode): Conflict | undefined {
  return conflicts.find((c) => c.code === code);
}

function rollupChecks(checks: ReadinessCheck[]): ReadinessLevel {
  if (checks.length === 0) return "not_applicable";
  if (checks.some((c) => c.state === "blocked")) return "blocked";
  if (checks.some((c) => c.state === "warnings")) return "warnings";
  if (checks.every((c) => c.state === "not_applicable")) return "not_applicable";
  return "ready";
}

function aggregateOverall(facets: FacetState[]): ReadinessLevel {
  if (facets.some((f) => f.level === "blocked")) return "blocked";
  if (facets.some((f) => f.level === "warnings")) return "warnings";
  return "ready";
}

// Maps a Conflict (if present) to a ReadinessCheck. Severity 'error' ->
// 'blocked', 'warning' -> 'warnings'. Absent conflict means the check
// passed.
function deriveFromConflict(
  id: string,
  label: string,
  conflict: Conflict | undefined,
): ReadinessCheck {
  if (!conflict) return { id, label, state: "ready" };
  return {
    id,
    label,
    state: conflict.severity === "error" ? "blocked" : "warnings",
    hint: conflict.message,
  };
}

function firstIssueLabel(checks: ReadinessCheck[], fallback: string): string {
  const blocked = checks.find((c) => c.state === "blocked");
  if (blocked) return blocked.label;
  const warning = checks.find((c) => c.state === "warnings");
  if (warning) return warning.label;
  return fallback;
}

// --- Content facet -------------------------------------------------------

function buildContentFacet(
  draft: Draft,
  validation: ValidationReport,
  conflicts: Conflict[],
): FacetState {
  const checks: ReadinessCheck[] = [
    {
      id: "schema_valid",
      label: "Content matches the article schema",
      state: validation.schemaValid ? "ready" : "blocked",
      hint: validation.schemaValid ? undefined : validation.schemaErrors.join("; "),
    },
  ];

  if (validation.schemaValid) {
    const post = draft.content as BlogPost;
    const allSectionsHaveContent =
      post.sections.length > 0 &&
      post.sections.every(
        (s) => s.heading.trim().length > 0 && s.content.length > 0,
      );
    checks.push({
      id: "sections_have_content",
      label: "All sections have a heading and body text",
      state: allSectionsHaveContent ? "ready" : "blocked",
      hint: allSectionsHaveContent
        ? undefined
        : "At least one section is missing a heading or paragraphs.",
    });
  }

  checks.push(
    deriveFromConflict(
      "no_duplicate_url",
      "No existing live article with this URL",
      findConflict(conflicts, "SLUG_DUPLICATES_PUBLISHED"),
    ),
    deriveFromConflict(
      "no_duplicate_draft_url",
      "No other draft uses this URL",
      findConflict(conflicts, "SLUG_DUPLICATES_OTHER_DRAFT"),
    ),
    deriveFromConflict(
      "no_duplicate_title",
      "Title is unique vs live articles",
      findConflict(conflicts, "TITLE_DUPLICATES_PUBLISHED"),
    ),
  );

  const level = rollupChecks(checks);
  const summary =
    level === "ready"
      ? "All content checks passed."
      : firstIssueLabel(checks, "Content needs attention.");

  return {
    facet: "content",
    label: FACET_LABELS.content,
    level,
    summary,
    checks,
  };
}

// --- Images facet --------------------------------------------------------

function aspectRatioCheck(image: BlogImage): ReadinessCheck {
  const ratio = image.width / image.height;
  if (!Number.isFinite(ratio) || ratio <= 0) {
    return {
      id: "hero_aspect_ratio",
      label: "Hero aspect ratio is computable",
      state: "warnings",
      hint: `Image dimensions ${image.width}×${image.height} look unusual.`,
    };
  }
  if (ratio < 1.2) {
    return {
      id: "hero_aspect_ratio",
      label: "Hero aspect ratio suits article layout",
      state: "warnings",
      hint: `Hero is ${image.width}×${image.height} (ratio ${ratio.toFixed(2)}). Landscape ≥ 1.2 renders better in the article layout.`,
    };
  }
  if (ratio > 2.4) {
    return {
      id: "hero_aspect_ratio",
      label: "Hero aspect ratio suits article layout",
      state: "warnings",
      hint: `Hero is ${image.width}×${image.height} (ratio ${ratio.toFixed(2)}). Extreme widescreen may crop oddly on mobile.`,
    };
  }
  return {
    id: "hero_aspect_ratio",
    label: "Hero aspect ratio suits article layout",
    state: "ready",
  };
}

function buildImagesFacet(post: BlogPost): FacetState {
  const checks: ReadinessCheck[] = [];

  if (post.hero) {
    checks.push({
      id: "hero_present",
      label: "Hero image attached",
      state: "ready",
    });
    checks.push({
      id: "hero_alt_text",
      label: "Hero has accessibility alt text",
      state: post.hero.altText.trim().length > 0 ? "ready" : "warnings",
      hint:
        post.hero.altText.trim().length > 0
          ? undefined
          : "Alt text helps screen readers describe the hero.",
    });
    checks.push(aspectRatioCheck(post.hero));
  } else {
    checks.push({
      id: "hero_present",
      label: "Hero image attached",
      state: "warnings",
      hint: "No hero attached. The article will publish text-only.",
    });
  }

  if (post.thumbnail) {
    checks.push({
      id: "thumbnail_present",
      label: "Thumbnail attached",
      state: "ready",
    });
  } else if (post.hero) {
    checks.push({
      id: "thumbnail_present",
      label: "Thumbnail attached (falls back to hero)",
      state: "ready",
      hint: "No dedicated thumbnail. Cards and social previews will use the hero.",
    });
  } else {
    checks.push({
      id: "thumbnail_present",
      label: "Thumbnail attached",
      state: "warnings",
      hint: "No hero or thumbnail. Cards and social previews will fall back to a product image.",
    });
  }

  const level = rollupChecks(checks);
  let summary: string;
  if (level === "ready") {
    summary = post.hero ? "Hero and thumbnail look good." : "Thumbnail attached.";
  } else if (!post.hero) {
    summary = "Hero image not attached — article will publish text-only.";
  } else {
    summary = firstIssueLabel(checks, "Some image checks need attention.");
  }

  return {
    facet: "images",
    label: FACET_LABELS.images,
    level,
    summary,
    checks,
  };
}

// --- SEO facet -----------------------------------------------------------

function buildSeoFacet(post: BlogPost, conflicts: Conflict[]): FacetState {
  const checks: ReadinessCheck[] = [
    deriveFromConflict(
      "title_length",
      "Title length suits search snippets",
      findConflict(conflicts, "METADATA_TITLE_LENGTH"),
    ),
    deriveFromConflict(
      "description_length",
      "Description length suits search snippets",
      findConflict(conflicts, "METADATA_DESCRIPTION_LENGTH"),
    ),
    {
      id: "keywords_present",
      label: "SEO keywords provided",
      state: post.keywords.length > 0 ? "ready" : "warnings",
      hint:
        post.keywords.length > 0
          ? undefined
          : "No keywords listed — these add search signals.",
    },
  ];

  const level = rollupChecks(checks);
  const summary =
    level === "ready"
      ? "Title, description, and keywords look good."
      : firstIssueLabel(checks, "Some SEO fields could be tuned.");

  return {
    facet: "seo",
    label: FACET_LABELS.seo,
    level,
    summary,
    checks,
  };
}

// --- CTA facet -----------------------------------------------------------

function buildCtaFacet(post: BlogPost, conflicts: Conflict[]): FacetState {
  const checks: ReadinessCheck[] = [
    {
      id: "cta_label_present",
      label: "Call-to-action has a label",
      state: post.cta.label.trim().length > 0 ? "ready" : "blocked",
      hint:
        post.cta.label.trim().length > 0
          ? undefined
          : "Empty CTA label would render an invisible button.",
    },
    deriveFromConflict(
      "cta_href_pattern",
      "CTA link matches the shop category pattern",
      findConflict(conflicts, "CTA_HREF_MALFORMED"),
    ),
  ];

  const level = rollupChecks(checks);
  const summary =
    level === "ready"
      ? "CTA label and link look good."
      : firstIssueLabel(checks, "CTA needs attention.");

  return {
    facet: "cta",
    label: FACET_LABELS.cta,
    level,
    summary,
    checks,
  };
}

// --- Metadata facet ------------------------------------------------------

function buildMetadataFacet(post: BlogPost, conflicts: Conflict[]): FacetState {
  const publishedAtParsed = new Date(post.publishedAt);
  const publishedAtValid = !Number.isNaN(publishedAtParsed.getTime());

  const checks: ReadinessCheck[] = [
    {
      id: "published_at_valid",
      label: "Publish date is a valid date",
      state: publishedAtValid ? "ready" : "warnings",
      hint: publishedAtValid
        ? undefined
        : `"${post.publishedAt}" can't be parsed as a date.`,
    },
    {
      id: "read_time_present",
      label: "Read time provided",
      state: post.readTime.trim().length > 0 ? "ready" : "warnings",
    },
    {
      id: "category_present",
      label: "Category set",
      // Category is enum-constrained by the schema; if validation passed,
      // category is always present and valid.
      state: "ready",
    },
    deriveFromConflict(
      "anchor_product_available",
      "Hero anchor product available in catalog",
      findConflict(conflicts, "CATEGORY_NO_PRODUCTS"),
    ),
  ];

  const level = rollupChecks(checks);
  const summary =
    level === "ready"
      ? "Metadata fields look good."
      : firstIssueLabel(checks, "Some metadata needs attention.");

  return {
    facet: "metadata",
    label: FACET_LABELS.metadata,
    level,
    summary,
    checks,
  };
}

// --- Channels facet ------------------------------------------------------

function buildChannelsFacet(): FacetState {
  const checks: ReadinessCheck[] = [
    {
      id: "blog_channel",
      label: "Blog (primary)",
      state: "ready",
    },
    {
      id: "email_channel",
      label: "Email digest",
      state: "not_applicable",
      hint: "Channel not yet wired.",
    },
    {
      id: "whatsapp_channel",
      label: "WhatsApp digest",
      state: "not_applicable",
      hint: "Channel not yet wired.",
    },
    {
      id: "social_channel",
      label: "Social snippets",
      state: "not_applicable",
      hint: "Channel not yet wired.",
    },
  ];

  // The blog channel is always ready post-Commit-K. Other channels are
  // intentionally scaffolded as not_applicable; they don't lower the
  // facet's level.
  return {
    facet: "channels",
    label: FACET_LABELS.channels,
    level: "ready",
    summary: "Blog channel ready. Email, WhatsApp, and social channels are not yet wired.",
    checks,
  };
}

// --- Orchestrator --------------------------------------------------------

export function computeReadiness(args: {
  draft: Draft;
  validation: ValidationReport;
  conflicts: Conflict[];
}): PublishingReadiness {
  const { draft, validation, conflicts } = args;

  // Schema-invalid short-circuit: downstream facet checks can't trust the
  // content shape. Surface content as blocked, dim the rest as
  // not_applicable so the operator focuses on content first.
  if (!validation.schemaValid) {
    const contentFacet = buildContentFacet(draft, validation, conflicts);
    const downstreamFacets: ReadinessFacet[] = [
      "images",
      "seo",
      "cta",
      "metadata",
      "channels",
    ];
    const facets: FacetState[] = [
      contentFacet,
      ...downstreamFacets.map<FacetState>((facet) => ({
        facet,
        label: FACET_LABELS[facet],
        level: "not_applicable",
        summary: "Fix the content schema before evaluating.",
        checks: [],
      })),
    ];
    return { overall: "blocked", facets };
  }

  const post = draft.content as BlogPost;
  const facets: FacetState[] = [
    buildContentFacet(draft, validation, conflicts),
    buildImagesFacet(post),
    buildSeoFacet(post, conflicts),
    buildCtaFacet(post, conflicts),
    buildMetadataFacet(post, conflicts),
    buildChannelsFacet(),
  ];

  return {
    overall: aggregateOverall(facets),
    facets,
  };
}
