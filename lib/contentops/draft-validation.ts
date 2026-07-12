// Deterministic draft-level validation. Drives the status badges shown
// in the ContentOps queue + draft detail (missing image, thin content,
// missing internal links, missing metadata).
//
// Thresholds intentionally mirror the production thresholds used by
// lib/seo-intelligence/content-decay.ts and metadata-coverage.ts so a
// draft that scores green here will not regress when it lands in the
// live blog and the SEO intelligence layer re-evaluates it.

import { getBlogAnchorProduct } from "@/lib/blog";
import { type Draft } from "@/lib/contentops/drafts-store";

const TITLE_MIN = 30;
const TITLE_MAX = 70;
const DESC_MIN = 80;
const DESC_MAX = 160;
const MIN_WORD_COUNT = 350;
const MIN_KEYWORDS = 3;
const MIN_SECTIONS = 3;

/**
 * Counts links that actually RENDER as anchors: markdown-style
 * `[text](/shop/slug)`, `[text](/blog/slug)`, `[text](/shop?category=…)`.
 * Bare URLs in plain text render as text, so they no longer count — the
 * badge and the renderer finally agree.
 */
const INTERNAL_LINK_REGEX =
  /\]\((\/(?:shop|blog)\/[A-Za-z0-9_-]+|\/shop\?category=[^)\s]+)\)/g;

export type DraftBadgeKey =
  | "missing_hero_image"
  | "thin_content"
  | "missing_internal_links"
  | "missing_metadata"
  | "schema_invalid"
  | "ready";

export type DraftBadge = {
  key: DraftBadgeKey;
  label: string;
  severity: "ok" | "info" | "warning" | "critical";
  detail: string;
};

export type DraftValidationReport = {
  wordCount: number;
  sectionCount: number;
  internalLinkCount: number;
  hasAnchorProduct: boolean;
  anchorImagePath: string | null;
  badges: DraftBadge[];
  /** Convenience: true when nothing critical is missing. */
  publishReady: boolean;
};

function countWords(draft: Draft): number {
  return draft.content.sections.reduce((sum, section) => {
    const sectionWords = section.content.reduce(
      (s, paragraph) => s + paragraph.trim().split(/\s+/).filter(Boolean).length,
      0,
    );
    return sum + sectionWords;
  }, 0);
}

function countInternalLinks(draft: Draft): number {
  const text = [
    ...draft.content.sections.flatMap((s) => [s.heading, ...s.content]),
    ...(draft.content.faq ?? []).map((f) => f.answer),
  ].join("\n");
  let count = 0;
  for (const _match of text.matchAll(INTERNAL_LINK_REGEX)) {
    count++;
  }
  // The CTA href renders as a real button link, so it counts too.
  if (/^\/shop\?category=/.test(draft.content.cta.href)) count++;
  return count;
}

export function validateDraft(draft: Draft): DraftValidationReport {
  const post = draft.content;
  const wordCount = countWords(draft);
  const sectionCount = post.sections.length;
  const internalLinkCount = countInternalLinks(draft);
  const anchor = getBlogAnchorProduct(post);
  const hasAnchorProduct = Boolean(anchor);
  const anchorImagePath = anchor?.image ?? null;

  const badges: DraftBadge[] = [];

  // Hero image badge.
  if (!hasAnchorProduct) {
    badges.push({
      key: "missing_hero_image",
      label: "Missing hero image",
      severity: "warning",
      detail: `No anchor product available in category "${post.relatedProductCategory}" — blog will render without a hero image.`,
    });
  }

  // Thin content badge.
  if (wordCount < MIN_WORD_COUNT || sectionCount < MIN_SECTIONS) {
    badges.push({
      key: "thin_content",
      label: "Thin content",
      severity: "warning",
      detail: `${wordCount} words across ${sectionCount} section(s); minimum ${MIN_WORD_COUNT} words and ${MIN_SECTIONS} sections recommended.`,
    });
  }

  // Internal-link signal.
  if (internalLinkCount === 0) {
    badges.push({
      key: "missing_internal_links",
      label: "No internal links",
      severity: "info",
      detail:
        "No rendered internal links. Write them as [anchor text](/shop/<slug>), [.](/blog/<slug>), or [.](/shop?category=…) inside a paragraph — they become real anchors on the page.",
    });
  }

  // Metadata badges (title + description length + keywords count).
  const metaIssues: string[] = [];
  const titleLen = post.title.length;
  const descLen = post.description.length;
  if (titleLen < TITLE_MIN || titleLen > TITLE_MAX) {
    metaIssues.push(`title ${titleLen} chars (target ${TITLE_MIN}–${TITLE_MAX})`);
  }
  if (descLen < DESC_MIN || descLen > DESC_MAX) {
    metaIssues.push(`description ${descLen} chars (target ${DESC_MIN}–${DESC_MAX})`);
  }
  if (post.keywords.length < MIN_KEYWORDS) {
    metaIssues.push(`${post.keywords.length} keyword(s), target ≥ ${MIN_KEYWORDS}`);
  }
  if (metaIssues.length > 0) {
    badges.push({
      key: "missing_metadata",
      label: "Metadata issues",
      severity: "warning",
      detail: metaIssues.join(" · "),
    });
  }

  if (badges.length === 0) {
    badges.push({
      key: "ready",
      label: "All checks passed",
      severity: "ok",
      detail: "No validation issues detected — safe to publish.",
    });
  }

  const publishReady = badges.every((b) => b.severity !== "critical");

  return {
    wordCount,
    sectionCount,
    internalLinkCount,
    hasAnchorProduct,
    anchorImagePath,
    badges,
    publishReady,
  };
}
