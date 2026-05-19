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
