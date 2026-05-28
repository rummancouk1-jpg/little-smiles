// Publish safety score. Aggregates the deterministic signals already
// computed by draft-validation + publish-prep (when available) into a
// single grade the reviewer can read in a heartbeat.
//
// The score is informational — it never blocks publish. The reviewer
// stays in control; this just sharpens the warning when something
// concrete is off.

import { products } from "@/lib/products";
import { validateDraft, type DraftValidationReport } from "@/lib/contentops/draft-validation";
import { type Draft } from "@/lib/contentops/drafts-store";
import { blogPostSchema } from "@/lib/contentops/blog-schema";

export type PublishSafetyVerdict = "ready" | "needs_review" | "do_not_publish_yet";

export type PublishScoreCheck = {
  key: string;
  label: string;
  weight: number;
  passed: boolean;
  detail: string;
  /** When passed=false: is this a blocking issue (do_not_publish_yet) or a soft one? */
  hard?: boolean;
};

export type PublishSafetyScore = {
  verdict: PublishSafetyVerdict;
  /** 0-100. */
  score: number;
  /** Up to ~10 checks. Each contributes its weight to the total when passed. */
  checks: PublishScoreCheck[];
  /** Human-readable summary line for headers / queue cards. */
  headline: string;
};

const TITLE_MIN = 30;
const TITLE_MAX = 70;
const DESC_MIN = 80;
const DESC_MAX = 160;
const WORD_MIN = 350;
const SECTION_MIN = 3;
const KEYWORD_MIN = 3;

function categoryHasProducts(category: string): boolean {
  return products.some((p) => p.category === category);
}

export function computePublishSafetyScore(
  draft: Draft,
  options?: {
    validation?: DraftValidationReport;
    /** Optional set of publish-prep conflict codes (for hero image / category warnings already merged). */
    publishPrepConflictCodes?: string[];
  },
): PublishSafetyScore {
  const v = options?.validation ?? validateDraft(draft);
  const conflictCodes = new Set(options?.publishPrepConflictCodes ?? []);
  const post = draft.content;

  const checks: PublishScoreCheck[] = [];

  checks.push({
    key: "word_count",
    label: "Word count above floor",
    weight: 12,
    passed: v.wordCount >= WORD_MIN,
    detail: `${v.wordCount} words (≥ ${WORD_MIN}).`,
  });

  checks.push({
    key: "section_count",
    label: "Section count above floor",
    weight: 8,
    passed: v.sectionCount >= SECTION_MIN,
    detail: `${v.sectionCount} sections (≥ ${SECTION_MIN}).`,
  });

  checks.push({
    key: "title_length",
    label: "Title within band",
    weight: 10,
    passed: post.title.length >= TITLE_MIN && post.title.length <= TITLE_MAX,
    detail: `${post.title.length} chars (target ${TITLE_MIN}-${TITLE_MAX}).`,
  });

  checks.push({
    key: "description_length",
    label: "Description within band",
    weight: 10,
    passed: post.description.length >= DESC_MIN && post.description.length <= DESC_MAX,
    detail: `${post.description.length} chars (target ${DESC_MIN}-${DESC_MAX}).`,
  });

  checks.push({
    key: "keywords",
    label: "Has enough keywords",
    weight: 6,
    passed: post.keywords.length >= KEYWORD_MIN,
    detail: `${post.keywords.length} keyword(s) (≥ ${KEYWORD_MIN}).`,
  });

  checks.push({
    key: "hero_image",
    label: "Hero image resolvable",
    weight: 12,
    passed: v.hasAnchorProduct || Boolean(draft.hero_image_path),
    detail: draft.hero_image_path
      ? "Reviewer hero image set."
      : v.hasAnchorProduct
        ? "Anchor product image will render."
        : `No anchor product in category "${post.relatedProductCategory}".`,
  });

  // Schema validity is structural — a failed parse is a hard block.
  const schemaParse = blogPostSchema.safeParse(post);
  checks.push({
    key: "schema_valid",
    label: "Schema valid (BlogPost)",
    weight: 14,
    passed: schemaParse.success,
    hard: true,
    detail: schemaParse.success
      ? "Draft content matches the BlogPost schema."
      : `Schema errors: ${schemaParse.error.issues.map((i) => i.path.join(".") || "(root)").join(", ")}`,
  });

  checks.push({
    key: "internal_links",
    label: "At least one internal link",
    weight: 6,
    passed: v.internalLinkCount >= 1,
    detail: `${v.internalLinkCount} internal link(s) detected.`,
  });

  // CTA must point to /shop?category=… (matches publish-prep CTA_HREF_MALFORMED).
  const ctaOk = /^\/shop\?category=.+$/.test(post.cta.href);
  checks.push({
    key: "cta_present",
    label: "CTA points to a real category",
    weight: 8,
    passed: ctaOk,
    detail: ctaOk ? "CTA matches /shop?category=<category>." : `CTA href: "${post.cta.href}".`,
  });

  // Category relevance — the CTA category must have at least one product.
  const categoryHas = categoryHasProducts(post.relatedProductCategory);
  checks.push({
    key: "category_has_products",
    label: "Related category has products",
    weight: 8,
    passed: categoryHas,
    detail: categoryHas
      ? `Category "${post.relatedProductCategory}" has live products.`
      : `Category "${post.relatedProductCategory}" has no products — CTA lands on empty grid.`,
  });

  // Slug conflict from publish-prep — when present, treat as hard.
  if (conflictCodes.has("SLUG_DUPLICATES_PUBLISHED")) {
    checks.push({
      key: "slug_unique",
      label: "Slug not already published",
      weight: 6,
      passed: false,
      hard: true,
      detail: "Slug duplicates a published post — would overwrite or 404.",
    });
  } else {
    checks.push({
      key: "slug_unique",
      label: "Slug not already published",
      weight: 6,
      passed: true,
      detail: "No slug collision with published posts.",
    });
  }

  const totalWeight = checks.reduce((sum, c) => sum + c.weight, 0);
  const earned = checks.reduce((sum, c) => (c.passed ? sum + c.weight : sum), 0);
  const score = Math.round((earned / totalWeight) * 100);

  const hasHardFailure = checks.some((c) => !c.passed && c.hard);
  const hasSoftFailure = checks.some((c) => !c.passed && !c.hard);
  let verdict: PublishSafetyVerdict;
  if (hasHardFailure || score < 60) verdict = "do_not_publish_yet";
  else if (score < 85) verdict = "needs_review";
  else verdict = "ready";

  const headline =
    verdict === "ready"
      ? hasSoftFailure
        ? `Ready (${score}/100) — technically publishable, but metadata should be reviewed.`
        : `Ready (${score}/100) — all required checks passed.`
      : verdict === "needs_review"
        ? `Needs Review (${score}/100) — not blocked, but improving this draft is recommended.`
        : `Do Not Publish Yet (${score}/100) — missing required image, schema, or content.`;

  return { verdict, score, checks, headline };
}
