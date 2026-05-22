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

  const blogSuggestions: LinkSuggestion[] = blogCandidates.map((c) => ({
    from: { kind: "blog", slug: post.slug, title: post.title },
    to: { kind: "blog", slug: c.post.slug, title: c.post.title },
    anchorSuggestion: buildAnchor(c.shared, c.post.title),
    reason: `Jaccard overlap ${c.value.toFixed(2)} on keywords[].`,
    confidence: c.value,
    sharedKeywords: c.shared,
  }));

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
    return {
      from: { kind: "blog", slug: post.slug, title: post.title },
      to: { kind: "product", slug: p.slug, title: p.name },
      anchorSuggestion: p.name,
      reason: isAnchor
        ? "Already the post's anchor product — link it directly in body copy."
        : `Same category (${p.category}); in stock; ${p.featured ? "featured" : "non-featured"}.`,
      confidence: isAnchor ? 1 : 0.6,
      sharedKeywords: [post.relatedProductCategory],
    };
  });
}

export function buildLinkSuggestionReport(): LinkSuggestionReport {
  const blogToBlog: LinkSuggestion[] = [];
  const blogToProduct: LinkSuggestion[] = [];
  const skipped: LinkSuggestionReport["skipped"] = [];

  for (const post of blogPosts) {
    const blogs = suggestionsForPost(post);
    const productsSuggested = productCandidatesForPost(post);
    blogToBlog.push(...blogs);
    blogToProduct.push(...productsSuggested);
    if (blogs.length === 0 && productsSuggested.length === 0) {
      skipped.push({
        slug: post.slug,
        reason: "No keyword overlap above threshold and no eligible product candidates.",
      });
    }
  }

  return { blogToBlog, blogToProduct, skipped };
}
