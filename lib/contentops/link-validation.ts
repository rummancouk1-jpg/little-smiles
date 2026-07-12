// Deterministic internal-link validation. Item 3 of the drafting-quality
// pass asks that inline links point to REAL destinations and never invent a
// URL — this enforces it in code rather than trusting the prompt: parse every
// [text](/path) internal link and, if its destination doesn't resolve, STRIP
// the link syntax (leaving the anchor text as plain words) so a broken URL can
// never ship. The prompt still gives the model the valid menu; this is the
// backstop.

import { type BlogPost, type BlogCategory } from "@/lib/contentops/blog-schema";

const LINK_PATTERN = /\[([^\]\n]{1,120})\]\((\/[^\s)]*)\)/g;

export type LinkTargets = {
  /** Real shop categories (for /shop?category=X). */
  categories: Set<string>;
  /** Slugs of existing live posts (for /blog/slug). */
  blogSlugs: Set<string>;
  /** Real product slugs (for /shop/slug). */
  productSlugs: Set<string>;
};

/** True when an internal href resolves to a real destination. */
export function isValidInternalHref(href: string, targets: LinkTargets): boolean {
  const categoryMatch = href.match(/^\/shop\?category=(.+)$/);
  if (categoryMatch) {
    // Query strings encode space as either %20 or + (form-encoding) — the
    // shop page's URLSearchParams handles both, so accept both here.
    const category = decodeURIComponent(categoryMatch[1].replace(/\+/g, " "));
    return targets.categories.has(category);
  }
  const blogMatch = href.match(/^\/blog\/([A-Za-z0-9_-]+)$/);
  if (blogMatch) {
    return targets.blogSlugs.has(blogMatch[1]);
  }
  const productMatch = href.match(/^\/shop\/([A-Za-z0-9_-]+)$/);
  if (productMatch) {
    return targets.productSlugs.has(productMatch[1]);
  }
  return false;
}

/** Strip invalid-link syntax from one paragraph, keeping valid ones intact. */
function cleanParagraph(
  text: string,
  targets: LinkTargets,
): { text: string; stripped: number; kept: number } {
  let stripped = 0;
  let kept = 0;
  const cleaned = text.replace(LINK_PATTERN, (full, anchor: string, href: string) => {
    if (isValidInternalHref(href, targets)) {
      kept++;
      return full;
    }
    stripped++;
    return anchor; // de-link: keep the words, drop the dead href
  });
  return { text: cleaned, stripped, kept };
}

export type LinkValidationResult = {
  draft: BlogPost;
  strippedLinks: { anchor: string; href: string }[];
  validLinkCount: number;
};

/**
 * Validate every internal link in a draft's body + FAQ answers. Invalid links
 * are stripped to plain text; the returned draft is safe to publish. Also
 * counts the CTA href as a valid link when it's a real category.
 */
export function validateAndCleanLinks(
  draft: BlogPost,
  targets: LinkTargets,
): LinkValidationResult {
  const strippedLinks: { anchor: string; href: string }[] = [];

  // Collect the invalid ones (for reporting) before the strip pass rewrites text.
  const scan = (text: string) => {
    for (const match of text.matchAll(LINK_PATTERN)) {
      const [, anchor, href] = match;
      if (!isValidInternalHref(href, targets)) {
        strippedLinks.push({ anchor, href });
      }
    }
  };
  for (const section of draft.sections) {
    for (const p of section.content) scan(p);
  }
  for (const item of draft.faq ?? []) scan(item.answer);

  let validLinkCount = 0;
  const sections = draft.sections.map((section) => ({
    ...section,
    content: section.content.map((p) => {
      const r = cleanParagraph(p, targets);
      validLinkCount += r.kept;
      return r.text;
    }),
  }));
  const faq = draft.faq?.map((item) => {
    const r = cleanParagraph(item.answer, targets);
    validLinkCount += r.kept;
    return { ...item, answer: r.text };
  });

  // The CTA renders as a real button link — count it if it points at a real category.
  if (isValidInternalHref(draft.cta.href, targets)) validLinkCount++;

  const cleaned: BlogPost = { ...draft, sections };
  if (faq) cleaned.faq = faq;

  return { draft: cleaned, strippedLinks, validLinkCount };
}

/** Build the human-readable "valid link targets" menu for the drafting prompt. */
export function buildLinkTargetsMenu(
  categories: BlogCategory[] | string[],
  blogSlugs: string[],
): string {
  const catLines = [...new Set(categories)].map(
    (c) => `- [anchor text](/shop?category=${encodeURIComponent(c)})`,
  );
  const blogLines = blogSlugs.map((s) => `- [anchor text](/blog/${s})`);
  return [
    "VALID LINK TARGETS (link ONLY to these — any other internal link is stripped before publish):",
    "Shop categories:",
    ...catLines,
    blogLines.length > 0 ? "Existing blog posts:" : "No existing blog posts to link yet.",
    ...blogLines,
  ]
    .filter(Boolean)
    .join("\n");
}
