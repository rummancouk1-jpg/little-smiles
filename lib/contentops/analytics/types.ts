// Analytics adapter types. Provider-agnostic so a future Google
// Analytics Data API client and a future Google Search Console client
// can plug in without changing the operator dashboard.

export type AnalyticsSource = "ga4" | "gsc" | "internal";

export type TopPagePoint = {
  /** Page path relative to siteUrl, e.g. /blog/foo. */
  path: string;
  /** 28-day pageviews. */
  views: number;
  /** Source provider id — useful when blending real GA4 + computed signals. */
  source: AnalyticsSource;
};

export type TopQueryPoint = {
  query: string;
  /** 28-day impressions in GSC. */
  impressions: number;
  /** 28-day clicks in GSC. */
  clicks: number;
  /** Click-through rate as a 0..1 fraction. */
  ctr: number;
  /** Average position; lower is better. */
  position: number;
};

export type IndexCoveragePoint = {
  /** ISO date (YYYY-MM-DD) representing the snapshot day. */
  date: string;
  /** Total indexed URLs in GSC for the property. */
  indexed: number;
};

export type EngagementPoint = {
  path: string;
  views: number;
  engagedSessions: number;
  /** Average engagement time per active user, seconds. */
  averageEngagementSeconds: number;
  /** GA4 bounce rate as a 0..1 fraction. */
  bounceRate: number;
};

export interface AnalyticsAdapter {
  readonly id: AnalyticsSource;
  isConfigured(): boolean;
  topPages(opts: { days: number; limit: number }): Promise<TopPagePoint[]>;
  /**
   * Per-page engagement signals. Used to identify pages that earn
   * pageviews but don't hold readers — high bounce-rate / low
   * engagement combos.
   */
  engagement(opts: { days: number; limit: number }): Promise<EngagementPoint[]>;
}

export type LowCtrOpportunity = {
  path: string;
  query: string;
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
};

export type DecliningPage = {
  path: string;
  /** Clicks in the current 28-day window. */
  recentClicks: number;
  /** Clicks in the prior 28-day window (29..56 days ago). */
  priorClicks: number;
  /** Negative percent change — e.g. -42 means down 42%. */
  changePercent: number;
};

export interface SearchConsoleAdapter {
  readonly id: "gsc";
  isConfigured(): boolean;
  topQueries(opts: { days: number; limit: number }): Promise<TopQueryPoint[]>;
  topPages(opts: { days: number; limit: number }): Promise<TopPagePoint[]>;
  indexCoverage(opts: { days: number }): Promise<IndexCoveragePoint[]>;
  /**
   * High-impression / low-CTR query+page pairs. The single best
   * lever for organic growth: rewriting the title/meta on these.
   */
  lowCtrOpportunities(opts: {
    days: number;
    limit: number;
    minImpressions: number;
    maxCtr: number;
  }): Promise<LowCtrOpportunity[]>;
  /**
   * Pages whose clicks dropped meaningfully in the most recent
   * 28-day window vs the prior 28-day window.
   */
  decliningPages(opts: {
    limit: number;
    minPriorClicks: number;
    minDropPercent: number;
  }): Promise<DecliningPage[]>;
}
