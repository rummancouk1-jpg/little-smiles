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

export interface AnalyticsAdapter {
  readonly id: AnalyticsSource;
  isConfigured(): boolean;
  topPages(opts: { days: number; limit: number }): Promise<TopPagePoint[]>;
}

export interface SearchConsoleAdapter {
  readonly id: "gsc";
  isConfigured(): boolean;
  topQueries(opts: { days: number; limit: number }): Promise<TopQueryPoint[]>;
  topPages(opts: { days: number; limit: number }): Promise<TopPagePoint[]>;
  indexCoverage(opts: { days: number }): Promise<IndexCoveragePoint[]>;
}
