// Content refresh intelligence. Pure deterministic module that derives
// per-article refresh recommendations from the signals we already
// produce — content health, optional GA4 engagement, optional GSC
// decline. No new external calls; the caller passes whatever it has.
//
// Output is intentionally small per article: a tight list of calm
// suggestions ranked by leverage. The analytics surface renders the
// list one row per article.

import type { BlogPost } from "@/lib/contentops/blog-schema";
import type {
  DecliningPage,
  EngagementPoint,
  LowCtrOpportunity,
} from "@/lib/contentops/analytics/types";
import type { ArticleHealthRow } from "@/lib/contentops/intelligence/content-health";

export type RefreshAction =
  | "refresh_content"
  | "regenerate_sections"
  | "add_faq"
  | "add_images"
  | "add_pinterest_pin"
  | "improve_internal_links"
  | "rewrite_title";

export type RefreshRecommendation = {
  slug: string;
  title: string;
  /** 0..100 — higher means stronger refresh signal. Used for sort + headline. */
  priorityScore: number;
  actions: RefreshAction[];
  /** One short reason per recommendation, in display order. */
  reasons: string[];
};

const ACTION_LABEL: Record<RefreshAction, string> = {
  refresh_content: "Refresh the article body",
  regenerate_sections: "Regenerate weak sections",
  add_faq: "Add an FAQ block",
  add_images: "Add a hero or section image",
  add_pinterest_pin: "Generate a Pinterest pin",
  improve_internal_links: "Add inbound internal links",
  rewrite_title: "Rewrite the title or meta description",
};

type Args = {
  articles: BlogPost[];
  health: ArticleHealthRow[];
  /** Optional GA4 engagement signals keyed by path. */
  engagement?: EngagementPoint[];
  /** Optional GSC decline signals keyed by path. */
  declines?: DecliningPage[];
  /** Optional GSC low-CTR pairs. */
  lowCtr?: LowCtrOpportunity[];
};

function slugFromPath(path: string): string | null {
  const m = path.match(/^\/blog\/([^/?#]+)/);
  return m ? m[1] : null;
}

export function computeRefreshRecommendations(args: Args): RefreshRecommendation[] {
  const { health } = args;
  const articleBySlug = new Map(args.articles.map((a) => [a.slug, a]));

  // Pre-index optional signals by slug.
  const engagementBySlug = new Map<string, EngagementPoint>();
  for (const e of args.engagement ?? []) {
    const slug = slugFromPath(e.path);
    if (slug) engagementBySlug.set(slug, e);
  }
  const declineBySlug = new Map<string, DecliningPage>();
  for (const d of args.declines ?? []) {
    const slug = slugFromPath(d.path);
    if (slug) declineBySlug.set(slug, d);
  }
  const lowCtrBySlug = new Map<string, LowCtrOpportunity[]>();
  for (const op of args.lowCtr ?? []) {
    const slug = slugFromPath(op.path);
    if (!slug) continue;
    const arr = lowCtrBySlug.get(slug) ?? [];
    arr.push(op);
    lowCtrBySlug.set(slug, arr);
  }

  const recs: RefreshRecommendation[] = [];
  for (const row of health) {
    const article = articleBySlug.get(row.slug);
    if (!article) continue;
    const actions: RefreshAction[] = [];
    const reasons: string[] = [];
    let score = 0;

    // Decay
    if (typeof row.ageDays === "number" && row.ageDays >= 180) {
      actions.push("refresh_content");
      reasons.push(`Last updated ${row.ageDays} days ago.`);
      score += Math.min(40, Math.floor(row.ageDays / 6));
    }

    // Section weakness — fewer than 3 sections
    if (article.sections.length < 3) {
      actions.push("regenerate_sections");
      reasons.push(
        `Only ${article.sections.length} section${article.sections.length === 1 ? "" : "s"} — articles with 4–6 read better and rank better.`,
      );
      score += 18;
    }

    // FAQ opportunity — articles whose title contains a question or
    // a "how to / what is" pattern but no FAQ section.
    const titleLower = article.title.toLowerCase();
    const hasFaqLikeSection = article.sections.some((s) =>
      /faq|question|q&a/i.test(s.heading),
    );
    if (
      !hasFaqLikeSection &&
      (titleLower.includes("how to") ||
        titleLower.includes("what is") ||
        titleLower.endsWith("?"))
    ) {
      actions.push("add_faq");
      reasons.push("Title implies a Q-and-A reader — an FAQ block earns featured-snippet eligibility.");
      score += 15;
    }

    // Image health
    if (!row.hasHero) {
      actions.push("add_images");
      reasons.push("Missing a hero image — visuals lift CTR on cards and social previews.");
      score += 22;
    }

    // Pinterest readiness
    if (row.pinterestReady) {
      actions.push("add_pinterest_pin");
      reasons.push(
        `Pinterest fit ${row.pinterestSuitability}/100 with no pin attached — high-leverage discovery work.`,
      );
      score += 16;
    }

    // Internal link orphan
    if (row.isOrphan) {
      actions.push("improve_internal_links");
      reasons.push("No inbound editorial links yet — orphans hurt crawl depth and authority.");
      score += 14;
    }

    // GSC decline
    const decline = declineBySlug.get(row.slug);
    if (decline) {
      actions.push("refresh_content");
      reasons.push(
        `Clicks down ${Math.abs(decline.changePercent)}% vs the prior 28 days (${decline.priorClicks} → ${decline.recentClicks}).`,
      );
      score += Math.min(30, Math.abs(decline.changePercent));
    }

    // Low CTR
    const lows = lowCtrBySlug.get(row.slug);
    if (lows && lows.length > 0) {
      const worst = lows[0];
      actions.push("rewrite_title");
      reasons.push(
        `High impressions / low CTR on "${worst.query}" — title or meta could be doing more work.`,
      );
      score += 18;
    }

    // Engagement
    const engagement = engagementBySlug.get(row.slug);
    if (engagement && engagement.views >= 50 && engagement.bounceRate >= 0.75) {
      if (!actions.includes("regenerate_sections")) actions.push("regenerate_sections");
      reasons.push(
        `Bounce rate ${(engagement.bounceRate * 100).toFixed(0)}% on ${engagement.views} views — readers leave fast.`,
      );
      score += 15;
    }

    if (actions.length === 0) continue;

    // Dedupe action list while preserving first-occurrence order.
    const seen = new Set<RefreshAction>();
    const dedupedActions: RefreshAction[] = [];
    for (const a of actions) {
      if (seen.has(a)) continue;
      seen.add(a);
      dedupedActions.push(a);
    }

    recs.push({
      slug: row.slug,
      title: row.title,
      priorityScore: Math.min(100, score),
      actions: dedupedActions,
      reasons: reasons.slice(0, 4),
    });
  }

  return recs.sort((a, b) => b.priorityScore - a.priorityScore);
}

export function refreshActionLabel(action: RefreshAction): string {
  return ACTION_LABEL[action];
}
