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
import { inferVisualStyle } from "@/lib/contentops/intelligence/visual-style-intelligence";
import type { Product } from "@/lib/products";

// Visible threshold for "old enough to consider refreshing".
const CONTENT_DECAY_DAYS = 180;
// Pinterest-fit score above which the article is "Pinterest-ready" if
// it doesn't already have a pinterest pin attached.
const PINTEREST_READY_MIN_SCORE = 75;

export type ArticleHealthRow = {
  slug: string;
  title: string;
  category: BlogPost["category"];
  cluster: TopicalCluster;
  publishedAt: string;
  ageDays: number | null;
  hasHero: boolean;
  hasThumbnail: boolean;
  hasOg: boolean;
  hasPinterest: boolean;
  hasImagePrompts: boolean;
  altCoverage: number; // 0..1 fraction of slots with non-empty alt text
  missingAltSlots: string[];
  pinterestSuitability: number;
  pinterestReady: boolean;
  inboundLinkCount: number;
  potentialInlineLinkCount: number;
  isOrphan: boolean;
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

  const now = Date.now();
  return articles.map((article) => {
    const inline = computeInlineLinkSuggestions({
      article,
      candidates: articles,
      products,
      maxLinks: 12,
      maxProductLinks: 4,
    });
    const inbound = inboundCounts.get(article.slug) ?? 0;
    const cluster = clusterForCategory(article.relatedProductCategory);
    const visual = inferVisualStyle({ post: article });

    // Alt-text coverage across attached slots only.
    const slots: Array<{ id: string; image?: { altText?: string } }> = [
      { id: "hero", image: article.hero },
      { id: "thumbnail", image: article.thumbnail },
      { id: "og", image: article.og },
      { id: "pinterest", image: article.pinterest },
    ];
    const attached = slots.filter((s) => s.image);
    const missingAltSlots = attached
      .filter(
        (s) =>
          !s.image?.altText || s.image.altText.trim().length === 0,
      )
      .map((s) => s.id);
    const altCoverage =
      attached.length === 0
        ? 1
        : (attached.length - missingAltSlots.length) / attached.length;

    // Age — Date.parse is lenient enough for our YYYY-MM-DD format.
    const ageMs = Date.parse(`${article.publishedAt}T12:00:00Z`);
    const ageDays = Number.isFinite(ageMs)
      ? Math.max(0, Math.floor((now - ageMs) / (24 * 60 * 60 * 1000)))
      : null;

    return {
      slug: article.slug,
      title: article.title,
      category: article.category,
      cluster,
      publishedAt: article.publishedAt,
      ageDays,
      hasHero: Boolean(article.hero),
      hasThumbnail: Boolean(article.thumbnail),
      hasOg: Boolean(article.og),
      hasPinterest: Boolean(article.pinterest),
      hasImagePrompts: Boolean(article.imagePrompts),
      altCoverage,
      missingAltSlots,
      pinterestSuitability: visual.pinterestSuitability,
      pinterestReady:
        !article.pinterest &&
        visual.pinterestSuitability >= PINTEREST_READY_MIN_SCORE,
      inboundLinkCount: inbound,
      potentialInlineLinkCount: inline.length,
      isOrphan: inbound === 0,
    };
  });
}

// ---------------------------------------------------------------------------
// Derived cluster strength + content-decay summaries
// ---------------------------------------------------------------------------

export type ClusterStrength = {
  cluster: TopicalCluster;
  articleCount: number;
  averageInbound: number;
  averageImageCoverage: number; // 0..1 fraction of articles with a hero
  daysSinceLastPublish: number | null;
  /** Composite score 0..100 — higher means stronger cluster. */
  strengthScore: number;
};

/**
 * Cluster-level strength derived from article health rows. Used by the
 * analytics dashboard to point the operator at clusters that are
 * carrying topical authority versus those that need attention.
 */
export function computeClusterStrength(
  rows: ArticleHealthRow[],
): ClusterStrength[] {
  const groups = new Map<TopicalCluster, ArticleHealthRow[]>();
  for (const row of rows) {
    const arr = groups.get(row.cluster) ?? [];
    arr.push(row);
    groups.set(row.cluster, arr);
  }
  return [...groups.entries()]
    .map(([cluster, items]) => {
      const articleCount = items.length;
      const inboundSum = items.reduce((acc, i) => acc + i.inboundLinkCount, 0);
      const averageInbound = articleCount === 0 ? 0 : inboundSum / articleCount;
      const heroCount = items.filter((i) => i.hasHero).length;
      const averageImageCoverage =
        articleCount === 0 ? 0 : heroCount / articleCount;
      const daysSinceLastPublish = items
        .map((i) => i.ageDays)
        .filter((d): d is number => typeof d === "number")
        .sort((a, b) => a - b)[0] ?? null;

      // Strength = volume * link-density * image-density * freshness.
      // Soft caps + scaled to 0..100.
      const volumeScore = Math.min(100, articleCount * 12);
      const inboundScore = Math.min(100, averageInbound * 30);
      const imageScore = averageImageCoverage * 100;
      const freshness =
        daysSinceLastPublish === null
          ? 0
          : daysSinceLastPublish < 30
            ? 100
            : daysSinceLastPublish < 90
              ? 70
              : daysSinceLastPublish < 180
                ? 40
                : 10;
      const strengthScore = Math.round(
        0.35 * volumeScore +
          0.30 * inboundScore +
          0.20 * imageScore +
          0.15 * freshness,
      );
      return {
        cluster,
        articleCount,
        averageInbound: Number(averageInbound.toFixed(2)),
        averageImageCoverage: Number(averageImageCoverage.toFixed(2)),
        daysSinceLastPublish,
        strengthScore,
      };
    })
    .sort((a, b) => b.strengthScore - a.strengthScore);
}

/**
 * Content-decay candidates: articles older than CONTENT_DECAY_DAYS,
 * sorted by oldest first. Operators refresh these to keep topical
 * authority current.
 */
export function computeContentDecay(
  rows: ArticleHealthRow[],
): ArticleHealthRow[] {
  return rows
    .filter(
      (r) =>
        typeof r.ageDays === "number" && r.ageDays >= CONTENT_DECAY_DAYS,
    )
    .sort((a, b) => (b.ageDays ?? 0) - (a.ageDays ?? 0));
}

/**
 * Pinterest-ready articles: high suitability and no pin attached yet.
 * Sorted by score descending.
 */
export function computePinterestReady(
  rows: ArticleHealthRow[],
): ArticleHealthRow[] {
  return rows
    .filter((r) => r.pinterestReady)
    .sort((a, b) => b.pinterestSuitability - a.pinterestSuitability);
}

/**
 * Articles with at least one attached image whose alt text is empty.
 */
export function computeMissingAlt(
  rows: ArticleHealthRow[],
): ArticleHealthRow[] {
  return rows.filter((r) => r.missingAltSlots.length > 0);
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
