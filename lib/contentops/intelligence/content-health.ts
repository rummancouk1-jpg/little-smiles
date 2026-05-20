// Pure operational derivations over the published-articles catalog.
// Used by /admin/contentops/analytics to surface calm "what needs work"
// lists without leaning on external analytics providers.
//
// Every helper takes an already-loaded list of BlogPosts so the page
// can fetch once and pass into many derivers. No DB hit here.

import type { BlogPost } from "@/lib/contentops/blog-schema";
import { clusterForCategory, type TopicalCluster } from "@/lib/contentops/intelligence/clusters";
import {
  computeInlineLinkSuggestions,
  computeLinkingSuggestions,
} from "@/lib/contentops/intelligence/relationships";
import type { Product } from "@/lib/products";

export type ArticleHealthRow = {
  slug: string;
  title: string;
  category: BlogPost["category"];
  cluster: TopicalCluster;
  hasHero: boolean;
  hasThumbnail: boolean;
  hasImagePrompts: boolean;
  inboundLinkCount: number;
  potentialInlineLinkCount: number;
};

/**
 * Heart of the dashboard: one row per article carrying every derived
 * signal the operational panels need. Computed eagerly so each panel
 * filters/sorts the same shape.
 */
export function computeArticleHealth(args: {
  articles: BlogPost[];
  products: Product[];
}): ArticleHealthRow[] {
  const { articles, products } = args;

  // Inbound link count: how many other articles plausibly link to this
  // one according to the relationships engine. Uses a strong-medium
  // threshold so we don't credit every weak keyword overlap.
  const inboundCounts = new Map<string, number>();
  for (const source of articles) {
    const suggestions = computeLinkingSuggestions({
      article: source,
      candidates: articles,
      products,
    });
    for (const rel of suggestions.relatedArticles) {
      if (rel.strength === "light") continue;
      inboundCounts.set(rel.article.slug, (inboundCounts.get(rel.article.slug) ?? 0) + 1);
    }
  }

  return articles.map((article) => {
    const inline = computeInlineLinkSuggestions({
      article,
      candidates: articles,
      products,
      maxLinks: 12,
      maxProductLinks: 4,
    });
    return {
      slug: article.slug,
      title: article.title,
      category: article.category,
      cluster: clusterForCategory(article.relatedProductCategory),
      hasHero: Boolean(article.hero),
      hasThumbnail: Boolean(article.thumbnail),
      hasImagePrompts: Boolean(article.imagePrompts),
      inboundLinkCount: inboundCounts.get(article.slug) ?? 0,
      potentialInlineLinkCount: inline.length,
    };
  });
}

export type ClusterCadence = {
  cluster: TopicalCluster;
  articleCount: number;
  /** Days since the most recent publish in this cluster, or null if none. */
  daysSinceLastPublish: number | null;
};

/**
 * Publishing-cadence breakdown. Helps the operator see which clusters
 * are receiving editorial attention and which are drifting.
 */
export function computeClusterCadence(articles: BlogPost[]): ClusterCadence[] {
  const byCluster = new Map<TopicalCluster, BlogPost[]>();
  for (const a of articles) {
    const c = clusterForCategory(a.relatedProductCategory);
    const arr = byCluster.get(c) ?? [];
    arr.push(a);
    byCluster.set(c, arr);
  }
  const now = Date.now();
  return [...byCluster.entries()]
    .map(([cluster, items]) => {
      const newest = items
        .map((p) => Date.parse(`${p.publishedAt}T12:00:00Z`))
        .filter((t) => Number.isFinite(t))
        .sort((a, b) => b - a)[0];
      const daysSince =
        typeof newest === "number"
          ? Math.max(0, Math.floor((now - newest) / (24 * 60 * 60 * 1000)))
          : null;
      return {
        cluster,
        articleCount: items.length,
        daysSinceLastPublish: daysSince,
      };
    })
    .sort((a, b) => b.articleCount - a.articleCount);
}
