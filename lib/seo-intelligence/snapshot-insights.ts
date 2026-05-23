// Snapshot-derived operational views. All derivations are deterministic
// transforms of the stored snapshot rows — no synthesis, no scoring.
// Every output table can be reproduced by reading the snapshot and
// applying the documented filter / sort below.
//
// Client-facing GA4 aggregations exclude /admin and /api/admin page paths
// so the "top pages" board the client sees reflects what their real users
// are doing, not what the operator is doing inside the admin console. The
// raw snapshot rows are never mutated — the exclusion is applied at view
// time and the totals/row counts for admin traffic are reported alongside
// so operators can still verify their own traffic is being captured.

import {
  ADMIN_PATH_EXCLUSION_NOTE,
  isAdminPagePath,
} from "@/lib/seo-intelligence/admin-traffic";
import type { Ga4PagePathRow } from "@/lib/providers/ga4";
import type { GscQueryRow } from "@/lib/providers/search-console";
import {
  getLatestGa4Snapshot,
  getLatestGscSnapshot,
  snapshotIsFresh,
  type StoredGa4Snapshot,
  type StoredGscSnapshot,
} from "@/lib/seo-intelligence/snapshots-store";

const TOP_N = 10;
const LOW_CTR_THRESHOLD = 0.02;
const LOW_CTR_MIN_IMPRESSIONS = 50;
const RISING_POSITION_THRESHOLD = 10.5;

export type GscInsights = {
  available: true;
  snapshot: StoredGscSnapshot;
  freshness: SnapshotFreshness;
  topByImpressions: GscQueryRow[];
  topByClicks: GscQueryRow[];
  lowCtrHighImpressions: GscQueryRow[];
  /** Queries already ranking on page 1 (avg position < 10.5) — the easy-win pool. */
  nearPageOne: GscQueryRow[];
  totals: { clicks: number; impressions: number };
};

export type Ga4TrafficSplit = {
  rowCount: number;
  sessions: number;
  totalUsers: number;
};

export type Ga4Insights = {
  available: true;
  snapshot: StoredGa4Snapshot;
  freshness: SnapshotFreshness;
  /** Client-facing tables — admin/internal paths excluded. */
  topBySessions: Ga4PagePathRow[];
  topByEngagement: Ga4PagePathRow[];
  highBounceWithTraffic: Ga4PagePathRow[];
  /** All-row totals (matches the raw snapshot). Kept for parity with the snapshot header. */
  totals: { sessions: number; totalUsers: number };
  /** Public traffic only — excludes any pagePath starting with /admin or /api/admin. */
  publicTotals: Ga4TrafficSplit;
  /** Admin/internal traffic — useful for verifying that operator activity is being captured. */
  adminTotals: Ga4TrafficSplit;
  /** Static note rendered next to the GA4 tables so the client knows the filter is on. */
  adminExclusionNote: string;
};

export type SnapshotFreshness = {
  isFresh: boolean;
  snapshotDate: string;
  ageDays: number;
};

export type SnapshotInsightsReport = {
  gsc: GscInsights | { available: false; reason: string };
  ga4: Ga4Insights | { available: false; reason: string };
};

function ageDaysFor(snapshotDate: string): number {
  const t = new Date(`${snapshotDate}T00:00:00Z`).getTime();
  if (!Number.isFinite(t)) return Number.POSITIVE_INFINITY;
  return Math.floor((Date.now() - t) / 86_400_000);
}

function freshnessFor(snapshot: { snapshotDate: string }): SnapshotFreshness {
  return {
    isFresh: snapshotIsFresh(snapshot),
    snapshotDate: snapshot.snapshotDate,
    ageDays: ageDaysFor(snapshot.snapshotDate),
  };
}

function deriveGscInsights(snapshot: StoredGscSnapshot): GscInsights {
  const rows = snapshot.rows;
  const topByImpressions = [...rows].sort((a, b) => b.impressions - a.impressions).slice(0, TOP_N);
  const topByClicks = [...rows].sort((a, b) => b.clicks - a.clicks).slice(0, TOP_N);
  const lowCtrHighImpressions = rows
    .filter((r) => r.impressions >= LOW_CTR_MIN_IMPRESSIONS && r.ctr < LOW_CTR_THRESHOLD)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, TOP_N);
  const nearPageOne = rows
    .filter((r) => r.position > 0 && r.position < RISING_POSITION_THRESHOLD)
    .sort((a, b) => a.position - b.position)
    .slice(0, TOP_N);
  const totals = rows.reduce(
    (acc, r) => ({ clicks: acc.clicks + r.clicks, impressions: acc.impressions + r.impressions }),
    { clicks: 0, impressions: 0 },
  );
  return {
    available: true,
    snapshot,
    freshness: freshnessFor(snapshot),
    topByImpressions,
    topByClicks,
    lowCtrHighImpressions,
    nearPageOne,
    totals,
  };
}

function deriveGa4Insights(snapshot: StoredGa4Snapshot): Ga4Insights {
  const rows = snapshot.rows;
  const publicRows = rows.filter((r) => !isAdminPagePath(r.pagePath));
  const adminRows = rows.filter((r) => isAdminPagePath(r.pagePath));

  // Client-facing tables use the public-only slice. Admin/internal traffic
  // would otherwise dominate "Top pages by sessions" while the site is
  // young and traffic is dominated by operator activity.
  const topBySessions = [...publicRows].sort((a, b) => b.sessions - a.sessions).slice(0, TOP_N);
  const topByEngagement = [...publicRows]
    .filter((r) => r.sessions >= 10)
    .sort((a, b) => b.averageSessionDurationSeconds - a.averageSessionDurationSeconds)
    .slice(0, TOP_N);
  const highBounceWithTraffic = publicRows
    .filter((r) => r.sessions >= 20 && r.bounceRate >= 0.7)
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, TOP_N);

  const totals = rows.reduce(
    (acc, r) => ({ sessions: acc.sessions + r.sessions, totalUsers: acc.totalUsers + r.totalUsers }),
    { sessions: 0, totalUsers: 0 },
  );
  const publicTotals = publicRows.reduce<Ga4TrafficSplit>(
    (acc, r) => ({
      rowCount: acc.rowCount + 1,
      sessions: acc.sessions + r.sessions,
      totalUsers: acc.totalUsers + r.totalUsers,
    }),
    { rowCount: 0, sessions: 0, totalUsers: 0 },
  );
  const adminTotals = adminRows.reduce<Ga4TrafficSplit>(
    (acc, r) => ({
      rowCount: acc.rowCount + 1,
      sessions: acc.sessions + r.sessions,
      totalUsers: acc.totalUsers + r.totalUsers,
    }),
    { rowCount: 0, sessions: 0, totalUsers: 0 },
  );

  return {
    available: true,
    snapshot,
    freshness: freshnessFor(snapshot),
    topBySessions,
    topByEngagement,
    highBounceWithTraffic,
    totals,
    publicTotals,
    adminTotals,
    adminExclusionNote: ADMIN_PATH_EXCLUSION_NOTE,
  };
}

export async function buildSnapshotInsightsReport(): Promise<SnapshotInsightsReport> {
  const [gscSnapshot, ga4Snapshot] = await Promise.all([
    getLatestGscSnapshot().catch(() => null),
    getLatestGa4Snapshot().catch(() => null),
  ]);

  const gsc: SnapshotInsightsReport["gsc"] = gscSnapshot
    ? deriveGscInsights(gscSnapshot)
    : { available: false, reason: "No Search Console snapshot yet. Connect GSC env vars and let the cron run, or trigger /api/cron/seo-snapshot with CRON_SECRET." };

  const ga4: SnapshotInsightsReport["ga4"] = ga4Snapshot
    ? deriveGa4Insights(ga4Snapshot)
    : { available: false, reason: "No GA4 snapshot yet. Connect GA4 Data API env vars and let the cron run, or trigger /api/cron/seo-snapshot with CRON_SECRET." };

  return { gsc, ga4 };
}
