// Pure correlator between Search Console signals and the article
// catalog. No I/O. Joins GSC rows (path-keyed) to articles via slug,
// and matches query strings against article keywords to surface
// editorial coverage gaps.

import type { BlogPost } from "@/lib/contentops/blog-schema";
import type {
  DecliningPage,
  LowCtrOpportunity,
  TopPagePoint,
  TopQueryPoint,
} from "@/lib/contentops/analytics/types";

export type QueryCoverageGap = {
  query: string;
  impressions: number;
  clicks: number;
  /** True when no published article carries this query as a keyword. */
  uncovered: boolean;
  /** Slug of the article the query most plausibly belongs to, if any. */
  suggestedAnchorSlug: string | null;
};

function slugFromPath(path: string): string | null {
  const m = path.match(/^\/blog\/([^/?#]+)/);
  return m ? m[1] : null;
}

/**
 * Join GSC top-pages to the catalog. Returns the subset where the
 * article exists in our content set, plus the matched BlogPost.
 */
export function joinPagesToArticles(
  pages: TopPagePoint[],
  articles: BlogPost[],
): Array<{ point: TopPagePoint; article: BlogPost }> {
  const bySlug = new Map(articles.map((a) => [a.slug, a]));
  const out: Array<{ point: TopPagePoint; article: BlogPost }> = [];
  for (const p of pages) {
    const slug = slugFromPath(p.path);
    if (!slug) continue;
    const article = bySlug.get(slug);
    if (!article) continue;
    out.push({ point: p, article });
  }
  return out;
}

/**
 * For each GSC query, determine whether any published article carries
 * it as a keyword (case-insensitive substring). When uncovered, attach
 * the most relevant article slug — picked by cluster + keyword overlap
 * — so the operator can quickly decide where to expand coverage.
 */
export function computeQueryCoverageGaps(
  queries: TopQueryPoint[],
  articles: BlogPost[],
): QueryCoverageGap[] {
  return queries.map((q) => {
    const lower = q.query.toLowerCase();
    let covered = false;
    let bestSlug: string | null = null;
    let bestScore = 0;
    for (const article of articles) {
      const matches = article.keywords.filter((k) =>
        lower.includes(k.toLowerCase()),
      );
      if (matches.length > 0) covered = true;
      const score =
        matches.length +
        (article.title.toLowerCase().includes(lower) ? 2 : 0) +
        (article.description.toLowerCase().includes(lower) ? 1 : 0);
      if (score > bestScore) {
        bestScore = score;
        bestSlug = article.slug;
      }
    }
    return {
      query: q.query,
      impressions: q.impressions,
      clicks: q.clicks,
      uncovered: !covered,
      suggestedAnchorSlug: bestSlug,
    };
  });
}

/**
 * Sort low-CTR opportunities into "easy rewrites first" order:
 * impressions-weighted, with a soft penalty on extremely low CTR
 * (since a 0.2% CTR usually means a brand-mismatch rather than a
 * fixable title).
 */
export function rankLowCtr(
  opportunities: LowCtrOpportunity[],
): LowCtrOpportunity[] {
  return [...opportunities].sort((a, b) => {
    const aScore = a.impressions * Math.max(0.001, a.ctr);
    const bScore = b.impressions * Math.max(0.001, b.ctr);
    return bScore - aScore;
  });
}

/**
 * Decorate decline rows with the matching article (where the path is
 * a blog post we own).
 */
export function joinDeclineToArticles(
  declines: DecliningPage[],
  articles: BlogPost[],
): Array<{ point: DecliningPage; article: BlogPost | null }> {
  const bySlug = new Map(articles.map((a) => [a.slug, a]));
  return declines.map((point) => {
    const slug = slugFromPath(point.path);
    return {
      point,
      article: slug ? bySlug.get(slug) ?? null : null,
    };
  });
}
