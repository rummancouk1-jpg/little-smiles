// Internal linking suggestion engine.
//
// Given the existing link graph (lib/seo-intelligence/internal-linking.ts)
// and the keyword overlap math from topic-grouping, produce concrete,
// safe, anchor-diverse suggestions. Every suggestion is:
//
//   - Explainable — the shared keywords + reason are returned with it.
//   - Confidence-scored — Jaccard overlap, capped at [0, 1].
//   - Loop-free — never suggests a post link to itself, and never
//     re-suggests an existing link.
//   - Anchor-diverse — the suggested anchor text is built from the
//     overlapping keyword (capitalised), not a generic "click here."

import { blogPosts, getBlogAnchorProduct, type BlogPost } from "@/lib/blog";
import { products, type Product } from "@/lib/products";

const MIN_JACCARD_FOR_SUGGESTION = 0.1;
const MAX_SUGGESTIONS_PER_POST = 3;
const MAX_PRODUCT_SUGGESTIONS_PER_POST = 2;

export type LinkSuggestion = {
  from: { kind: "blog"; slug: string; title: string };
  to: { kind: "blog" | "product"; slug: string; title: string };
  anchorSuggestion: string;
  reason: string;
  confidence: number;
  sharedKeywords: string[];
  /**
   * The section heading in the source post where this link is most likely
   * to fit naturally. Picked as the section whose heading or content
   * mentions the strongest shared keyword. `null` when no section is a
   * clear winner — the reviewer can still place it anywhere.
   */
  placementSectionHeading: string | null;
  /**
   * A ready-to-paste sentence the reviewer can drop into the placement
   * section. Always references the destination title, never invents
   * stats or claims. Deterministic — same inputs → same sentence.
   */
  suggestedSentence: string;
  /**
   * Final URL the anchor should point to — already prefixed (`/blog/...`
   * for blog suggestions, `/shop/...` for product suggestions).
   */
  destinationHref: string;
  /**
   * Multi-line instruction the reviewer can paste straight to a writer.
   * Covers source page, destination, placement, anchor text, exact
   * sentence, and rationale.
   */
  instructionText: string;
};

export type LinkSuggestionReport = {
  blogToBlog: LinkSuggestion[];
  blogToProduct: LinkSuggestion[];
  /** Posts that already have ≥ 2 outbound suggestions wired in body text — no new ones offered. */
  skipped: { slug: string; reason: string }[];
};

function normaliseKeywords(post: BlogPost): Set<string> {
  return new Set(post.keywords.map((k) => k.trim().toLowerCase()).filter(Boolean));
}

function jaccard(a: Set<string>, b: Set<string>): { value: number; shared: string[] } {
  const intersection: string[] = [];
  for (const key of a) {
    if (b.has(key)) intersection.push(key);
  }
  const unionSize = new Set([...a, ...b]).size;
  if (unionSize === 0) return { value: 0, shared: [] };
  return { value: intersection.length / unionSize, shared: intersection };
}

const INTERNAL_LINK_REGEX = /\/(shop|blog)\/[A-Za-z0-9_-]+/g;
function existingOutboundSlugs(post: BlogPost): {
  blogSlugs: Set<string>;
  productSlugs: Set<string>;
} {
  const blogSlugs = new Set<string>();
  const productSlugs = new Set<string>();
  const text = [
    post.title,
    post.description,
    ...post.sections.flatMap((s) => [s.heading, ...s.content]),
    post.cta.label,
    post.cta.href,
  ].join("\n");
  for (const match of text.matchAll(INTERNAL_LINK_REGEX)) {
    const [whole, kind] = match;
    const slug = whole.split("/").pop()!;
    if (kind === "blog") blogSlugs.add(slug);
    if (kind === "shop") productSlugs.add(slug);
  }
  return { blogSlugs, productSlugs };
}

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => (w.length === 0 ? w : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
}

function buildAnchor(sharedKeywords: string[], fallback: string): string {
  const best = sharedKeywords.find((k) => k.length >= 5 && k.length <= 60);
  if (best) return titleCase(best);
  return fallback;
}

/**
 * Pick the section in the source post that is most likely to host this
 * link naturally. Strategy: score each section by how many of the shared
 * keywords appear in heading or content; return the highest scorer, ties
 * broken by section order. Returns null when no section mentions any
 * shared keyword.
 */
function pickPlacementSection(post: BlogPost, sharedKeywords: string[]): string | null {
  if (sharedKeywords.length === 0) return null;
  let bestHeading: string | null = null;
  let bestScore = 0;
  for (const section of post.sections) {
    const text = `${section.heading}\n${section.content.join("\n")}`.toLowerCase();
    let score = 0;
    for (const k of sharedKeywords) {
      if (text.includes(k.toLowerCase())) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestHeading = section.heading;
    }
  }
  return bestHeading;
}

function buildBlogSentence(toTitle: string, sharedKeywords: string[]): string {
  const lead = sharedKeywords.find((k) => k.length >= 4) ?? "this topic";
  return `For more on ${lead.toLowerCase()}, see our guide on ${toTitle}.`;
}

function buildProductSentence(toName: string, category: string, isAnchor: boolean): string {
  if (isAnchor) {
    return `If you're looking for a strong ${category.toLowerCase()} option, ${toName} is our go-to pick for this guide.`;
  }
  return `A reliable ${category.toLowerCase()} option that fits this article's recommendations is ${toName}.`;
}

function buildInstruction(input: {
  fromTitle: string;
  fromSlug: string;
  destinationTitle: string;
  destinationHref: string;
  placementSectionHeading: string | null;
  anchorSuggestion: string;
  suggestedSentence: string;
  reason: string;
}): string {
  const placement = input.placementSectionHeading
    ? `Inside the section titled "${input.placementSectionHeading}".`
    : `Inside whichever existing section reads most naturally.`;
  return [
    `Little Smiles — Internal link instruction`,
    ``,
    `Source page:      /blog/${input.fromSlug}`,
    `Source title:     ${input.fromTitle}`,
    `Destination URL:  ${input.destinationHref}`,
    `Destination:      ${input.destinationTitle}`,
    `Placement:        ${placement}`,
    `Anchor text:      "${input.anchorSuggestion}"`,
    ``,
    `Sentence to paste (or rewrite around to keep flow natural):`,
    `  ${input.suggestedSentence}`,
    ``,
    `Why this link:    ${input.reason}`,
    ``,
    `Notes:`,
    `- Keep the surrounding paragraph readable — never wedge the anchor in.`,
    `- Don't repeat the same anchor text elsewhere in this article.`,
    `- The link is internal — no nofollow / sponsored attributes needed.`,
  ].join("\n");
}

function suggestionsForPost(post: BlogPost): LinkSuggestion[] {
  const sourceKeywords = normaliseKeywords(post);
  const existing = existingOutboundSlugs(post);

  // Blog-to-blog candidates.
  const blogCandidates = blogPosts
    .filter((p) => p.slug !== post.slug && !existing.blogSlugs.has(p.slug))
    .map((p) => {
      const { value, shared } = jaccard(sourceKeywords, normaliseKeywords(p));
      return { post: p, value, shared };
    })
    .filter((c) => c.value >= MIN_JACCARD_FOR_SUGGESTION)
    .sort((a, b) => b.value - a.value)
    .slice(0, MAX_SUGGESTIONS_PER_POST);

  const blogSuggestions: LinkSuggestion[] = blogCandidates.map((c) => {
    const anchor = buildAnchor(c.shared, c.post.title);
    const placement = pickPlacementSection(post, c.shared);
    const sentence = buildBlogSentence(c.post.title, c.shared);
    const destinationHref = `/blog/${c.post.slug}`;
    return {
      from: { kind: "blog", slug: post.slug, title: post.title },
      to: { kind: "blog", slug: c.post.slug, title: c.post.title },
      anchorSuggestion: anchor,
      reason: `Jaccard overlap ${c.value.toFixed(2)} on keywords[].`,
      confidence: c.value,
      sharedKeywords: c.shared,
      placementSectionHeading: placement,
      suggestedSentence: sentence,
      destinationHref,
      instructionText: buildInstruction({
        fromTitle: post.title,
        fromSlug: post.slug,
        destinationTitle: c.post.title,
        destinationHref,
        placementSectionHeading: placement,
        anchorSuggestion: anchor,
        suggestedSentence: sentence,
        reason: `Shared keywords with the destination (${c.shared.join(", ") || "n/a"}). Jaccard ${c.value.toFixed(2)}.`,
      }),
    };
  });

  return blogSuggestions;
}

function productCandidatesForPost(post: BlogPost): LinkSuggestion[] {
  const existing = existingOutboundSlugs(post);

  // Eligible products: same relatedProductCategory, in stock, not already
  // referenced in body. Sort featured first, then bestSeller.
  const eligible: Product[] = products
    .filter((p) => p.category === post.relatedProductCategory)
    .filter((p) => p.inStock)
    .filter((p) => !existing.productSlugs.has(p.slug))
    .sort((a, b) => {
      const aRank = (a.featured ? 2 : 0) + (a.bestSeller ? 1 : 0);
      const bRank = (b.featured ? 2 : 0) + (b.bestSeller ? 1 : 0);
      return bRank - aRank;
    })
    .slice(0, MAX_PRODUCT_SUGGESTIONS_PER_POST);

  // Confidence = 1.0 if the post's anchor already resolves to this exact
  // product (strong topical bond), else 0.6 for same-category in-stock.
  const anchor = getBlogAnchorProduct(post);
  return eligible.map((p) => {
    const isAnchor = anchor?.slug === p.slug;
    const sharedKeywords = [post.relatedProductCategory];
    const placement = pickPlacementSection(post, sharedKeywords);
    const sentence = buildProductSentence(p.name, p.category, isAnchor);
    const destinationHref = `/shop/${p.slug}`;
    const anchorText = p.name;
    const reason = isAnchor
      ? "Already the post's anchor product — link it directly in body copy."
      : `Same category (${p.category}); in stock; ${p.featured ? "featured" : "non-featured"}.`;
    return {
      from: { kind: "blog", slug: post.slug, title: post.title },
      to: { kind: "product", slug: p.slug, title: p.name },
      anchorSuggestion: anchorText,
      reason,
      confidence: isAnchor ? 1 : 0.6,
      sharedKeywords,
      placementSectionHeading: placement,
      suggestedSentence: sentence,
      destinationHref,
      instructionText: buildInstruction({
        fromTitle: post.title,
        fromSlug: post.slug,
        destinationTitle: p.name,
        destinationHref,
        placementSectionHeading: placement,
        anchorSuggestion: anchorText,
        suggestedSentence: sentence,
        reason,
      }),
    };
  });
}

/**
 * Per-post anchor dedup. Within a single source post, suggesting the
 * same anchor text for two different destinations creates over-optimised
 * repeated anchors — Google penalises this and reviewers find it confusing.
 * We keep only the first suggestion per (sourceSlug + anchor) pair.
 */
function dedupeAnchorPerSource(suggestions: LinkSuggestion[]): LinkSuggestion[] {
  const seen = new Set<string>();
  const out: LinkSuggestion[] = [];
  for (const s of suggestions) {
    const key = `${s.from.slug}::${s.anchorSuggestion.toLowerCase().trim()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

/**
 * Cross-list dedup. If the same blog→product pair shows up in both lists
 * (shouldn't happen by construction, but defend against it), keep only
 * the higher-confidence row.
 */
function dedupeSourceDestinationPair(suggestions: LinkSuggestion[]): LinkSuggestion[] {
  const bestByKey = new Map<string, LinkSuggestion>();
  for (const s of suggestions) {
    const key = `${s.from.slug}::${s.to.kind}::${s.to.slug}`;
    const existing = bestByKey.get(key);
    if (!existing || s.confidence > existing.confidence) {
      bestByKey.set(key, s);
    }
  }
  return Array.from(bestByKey.values());
}

export function buildLinkSuggestionReport(): LinkSuggestionReport {
  const rawBlog: LinkSuggestion[] = [];
  const rawProduct: LinkSuggestion[] = [];
  const skipped: LinkSuggestionReport["skipped"] = [];

  for (const post of blogPosts) {
    const blogs = suggestionsForPost(post);
    const productsSuggested = productCandidatesForPost(post);
    rawBlog.push(...blogs);
    rawProduct.push(...productsSuggested);
    if (blogs.length === 0 && productsSuggested.length === 0) {
      skipped.push({
        slug: post.slug,
        reason: "No keyword overlap above threshold and no eligible product candidates.",
      });
    }
  }

  // Apply anchor diversity per source post across both lists combined —
  // a post shouldn't link to a blog AND a product using the identical
  // anchor text either.
  const dedupedAnchor = dedupeAnchorPerSource([...rawBlog, ...rawProduct]);
  const dedupedPair = dedupeSourceDestinationPair(dedupedAnchor);
  const blogToBlog = dedupedPair.filter((s) => s.to.kind === "blog");
  const blogToProduct = dedupedPair.filter((s) => s.to.kind === "product");

  return { blogToBlog, blogToProduct, skipped };
}
