// Editorial relationship engine — calm internal-linking intelligence.
//
// Pure function. Inputs: the article being analyzed + candidate articles
// + the product catalog. Outputs: ranked related articles and ranked
// related products, each carrying a single one-line editorial reason
// and a strength band (strong / medium / light).
//
// Design intent: this is editorial guidance, not SEO automation. The
// scoring is deliberately simple weighted heuristics so the reasons
// surface as natural editorial connections rather than algorithmic
// scores. Future intelligence layers (analytics feedback, learned
// authority) can rerank or augment the contributions without
// restructuring the engine.
//
// Project-coupling note: the engine imports the Product type from
// lib/products because relationship reasoning requires understanding
// of the catalog's category model. For SaaS multi-tenancy this would
// move behind an adapter that exposes a tenant's catalog. Today,
// single-tenant Little Smiles, direct import is the calmest path.

import type { BlogPost } from "@/lib/contentops/blog-schema";
import { clusterForCategory } from "@/lib/contentops/intelligence/clusters";
import type { Product } from "@/lib/products";

export type RelationshipStrength = "strong" | "medium" | "light";

export type ArticleRelationship = {
  article: BlogPost;
  reason: string;
  strength: RelationshipStrength;
  score: number;
};

export type ProductRelationship = {
  product: Product;
  reason: string;
  strength: RelationshipStrength;
  score: number;
};

export type LinkingSuggestions = {
  relatedArticles: ArticleRelationship[];
  relatedProducts: ProductRelationship[];
};

type LinkingArgs = {
  article: BlogPost;
  candidates: BlogPost[];
  products: Product[];
};

function strengthFor(score: number): RelationshipStrength {
  if (score >= 5) return "strong";
  if (score >= 3) return "medium";
  return "light";
}

function normalizedKeywordSet(post: BlogPost): Set<string> {
  return new Set(post.keywords.map((k) => k.toLowerCase().trim()).filter((k) => k.length > 0));
}

function scoreArticle(
  target: BlogPost,
  candidate: BlogPost,
): { score: number; reason: string } {
  const reasons: string[] = [];
  let score = 0;

  // Strongest editorial signal — same product anchor means the two
  // articles support the same purchase journey.
  if (target.relatedProductCategory === candidate.relatedProductCategory) {
    score += 3;
    reasons.push(`Both anchor to the ${target.relatedProductCategory} collection`);
  } else if (
    clusterForCategory(target.relatedProductCategory) ===
    clusterForCategory(candidate.relatedProductCategory)
  ) {
    // Cross-anchor pair inside the same topical cluster (e.g. Food Bag
    // ↔ Bottle Case both live in Outings). Weaker than a direct anchor
    // match but stronger than no relationship — supports topical
    // authority building across adjacent product lines.
    score += 2;
    reasons.push(
      `Both sit in the ${clusterForCategory(target.relatedProductCategory)} cluster`,
    );
  }

  // Same editorial category.
  if (target.category === candidate.category) {
    score += 2;
    if (target.relatedProductCategory !== candidate.relatedProductCategory) {
      reasons.push(`Same ${target.category} category`);
    }
  }

  // Keyword overlap — capped at +3 so a stuffed-keyword article doesn't
  // dominate the rankings.
  const targetKeywords = normalizedKeywordSet(target);
  const candidateKeywords = normalizedKeywordSet(candidate);
  const shared = [...targetKeywords].filter((k) => candidateKeywords.has(k));
  if (shared.length > 0) {
    score += Math.min(shared.length, 3);
    if (reasons.length === 0) {
      reasons.push(
        `Shares ${shared.length} keyword${shared.length === 1 ? "" : "s"} with this article`,
      );
    }
  }

  const reason = reasons[0] ?? "Topically related";
  return { score, reason };
}

function scoreProduct(
  article: BlogPost,
  product: Product,
): { score: number; reason: string } {
  // Anchor product — same category as the article's relatedProductCategory.
  // Strongest editorial connection by design.
  if (product.category === article.relatedProductCategory) {
    return {
      score: 5,
      reason: `Anchor product in the ${product.category} collection`,
    };
  }

  // Keyword resonance — the product name contains one or more of the
  // article's keywords. Indicates a natural editorial pairing without
  // forcing a category match.
  const productNameLower = product.name.toLowerCase();
  const matches = article.keywords.filter((k) => {
    const normalized = k.toLowerCase().trim();
    return normalized.length > 0 && productNameLower.includes(normalized);
  });
  if (matches.length > 0) {
    return {
      score: 2 + Math.min(matches.length, 3),
      reason: `Naturally pairs with "${matches[0]}"`,
    };
  }

  return { score: 0, reason: "" };
}

export function computeLinkingSuggestions(args: LinkingArgs): LinkingSuggestions {
  const { article, candidates, products } = args;

  const scoredArticles: ArticleRelationship[] = candidates
    .filter((candidate) => candidate.slug !== article.slug)
    .map((candidate) => {
      const { score, reason } = scoreArticle(article, candidate);
      return {
        article: candidate,
        score,
        reason,
        strength: strengthFor(score),
      };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);

  const scoredProducts: ProductRelationship[] = products
    .map((product) => {
      const { score, reason } = scoreProduct(article, product);
      return {
        product,
        score,
        reason,
        strength: strengthFor(score),
      };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);

  return {
    relatedArticles: scoredArticles,
    relatedProducts: scoredProducts,
  };
}

// ---------------------------------------------------------------------------
// Inline link suggestions
// ---------------------------------------------------------------------------
// Goal: surface a small, calm list of "this phrase in this section could
// become a link to this article/product" suggestions for the operator.
//
// Constraints (deliberately strict so the output stays editorial):
//   - Never suggest a self-link.
//   - Never suggest the same destination twice.
//   - Only the first occurrence of any anchor phrase counts.
//   - Hard cap on total links per article (configurable).
//   - Phrase must match an actual keyword the candidate article carries,
//     or a product name token — not arbitrary substring matches.

export type InlineLinkKind = "article" | "product";

export type InlineLinkSuggestion = {
  kind: InlineLinkKind;
  /** The phrase as it appears (case-preserved) in the article body. */
  anchor: string;
  /** Editorial destination — slug only; the renderer composes the href. */
  destinationSlug: string;
  /** Human-readable title of the destination — for the operator UI. */
  destinationTitle: string;
  /** Which section index the anchor lives in (0-based). */
  sectionIndex: number;
  /** Calm one-line reason (e.g. "Matches keyword 'baby sleep'"). */
  reason: string;
};

type InlineArgs = {
  article: BlogPost;
  candidates: BlogPost[];
  products: Product[];
  /** Hard cap on total suggestions returned. Default 4. */
  maxLinks?: number;
  /** Optional cap on product suggestions specifically. Default 2. */
  maxProductLinks?: number;
};

function tokenizeBody(article: BlogPost): { sectionIndex: number; text: string }[] {
  return article.sections.map((section, idx) => ({
    sectionIndex: idx,
    text: section.content.join("\n"),
  }));
}

/**
 * Look for the first case-insensitive occurrence of `needle` inside any
 * section. Returns the section index + the original-case substring as it
 * appears in the body so the operator sees their own wording back.
 */
function firstOccurrence(
  article: BlogPost,
  needle: string,
): { sectionIndex: number; matched: string } | null {
  const trimmed = needle.trim();
  if (trimmed.length < 3) return null;
  const lowerNeedle = trimmed.toLowerCase();
  for (const { sectionIndex, text } of tokenizeBody(article)) {
    const lower = text.toLowerCase();
    const at = lower.indexOf(lowerNeedle);
    if (at < 0) continue;
    return {
      sectionIndex,
      matched: text.slice(at, at + trimmed.length),
    };
  }
  return null;
}

export function computeInlineLinkSuggestions(args: InlineArgs): InlineLinkSuggestion[] {
  const { article, candidates, products } = args;
  const maxLinks = Math.max(1, args.maxLinks ?? 4);
  const maxProductLinks = Math.max(0, args.maxProductLinks ?? 2);

  const usedSlugs = new Set<string>([article.slug]);
  const usedAnchors = new Set<string>();
  const out: InlineLinkSuggestion[] = [];

  // 1) Article suggestions — keyword anchors first, ranked by article
  //    relationship score so the strongest topical connections surface
  //    earliest.
  const articleScored = candidates
    .filter((c) => c.slug !== article.slug)
    .map((c) => ({ candidate: c, score: scoreArticle(article, c).score }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);

  for (const { candidate } of articleScored) {
    if (out.length >= maxLinks) break;
    if (usedSlugs.has(candidate.slug)) continue;
    // Try each candidate keyword in turn until one matches in the body.
    for (const keyword of candidate.keywords) {
      const k = keyword.toLowerCase().trim();
      if (!k || usedAnchors.has(k)) continue;
      const hit = firstOccurrence(article, keyword);
      if (!hit) continue;
      out.push({
        kind: "article",
        anchor: hit.matched,
        destinationSlug: candidate.slug,
        destinationTitle: candidate.title,
        sectionIndex: hit.sectionIndex,
        reason: `Matches keyword "${keyword}" from "${candidate.title}"`,
      });
      usedSlugs.add(candidate.slug);
      usedAnchors.add(k);
      break;
    }
  }

  // 2) Product suggestions — match the product name (or its main token)
  //    against the body. Bounded separately from article links so a
  //    purely commercial article doesn't drown out editorial connections.
  let productLinksUsed = 0;
  const productScored = products
    .map((p) => ({ product: p, score: scoreProduct(article, p).score }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);

  for (const { product } of productScored) {
    if (out.length >= maxLinks) break;
    if (productLinksUsed >= maxProductLinks) break;
    if (usedSlugs.has(product.slug)) continue;
    const candidatePhrases = [product.name, ...product.name.split(/\s+/).filter((t) => t.length > 4)];
    for (const phrase of candidatePhrases) {
      const k = phrase.toLowerCase().trim();
      if (!k || usedAnchors.has(k)) continue;
      const hit = firstOccurrence(article, phrase);
      if (!hit) continue;
      out.push({
        kind: "product",
        anchor: hit.matched,
        destinationSlug: product.slug,
        destinationTitle: product.name,
        sectionIndex: hit.sectionIndex,
        reason: `Naturally pairs with the ${product.category} collection`,
      });
      usedSlugs.add(product.slug);
      usedAnchors.add(k);
      productLinksUsed += 1;
      break;
    }
  }

  return out;
}
