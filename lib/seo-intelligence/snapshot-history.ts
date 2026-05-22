// Historical snapshot store + deterministic comparison engine.
//
// Every metric on a "comparison" is a simple difference between two
// real persisted snapshots — no extrapolation, no fabrication. When a
// comparison snapshot is missing (e.g. less than 7 days of history),
// the relevant field is `null` so the UI can render "—" honestly.

import type { Ga4PagePathRow } from "@/lib/providers/ga4";
import type { GscQueryRow } from "@/lib/providers/search-console";
import { logSeo } from "@/lib/seo-intelligence/logger";
import {
  type StoredGa4Snapshot,
  type StoredGscSnapshot,
} from "@/lib/seo-intelligence/snapshots-store";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

type SupabaseClient = ReturnType<typeof getSupabaseAdminClient>;

function isoDateNDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function mapGscRow(data: {
  id: string;
  snapshot_date: string;
  window_start: string;
  window_end: string;
  row_count: number;
  rows: GscQueryRow[];
  created_at: string;
}): StoredGscSnapshot {
  return {
    id: data.id,
    snapshotDate: data.snapshot_date,
    windowStart: data.window_start,
    windowEnd: data.window_end,
    rowCount: data.row_count,
    rows: Array.isArray(data.rows) ? data.rows : [],
    createdAt: data.created_at,
  };
}

function mapGa4Row(data: {
  id: string;
  snapshot_date: string;
  window_start: string;
  window_end: string;
  row_count: number;
  rows: Ga4PagePathRow[];
  created_at: string;
}): StoredGa4Snapshot {
  return {
    id: data.id,
    snapshotDate: data.snapshot_date,
    windowStart: data.window_start,
    windowEnd: data.window_end,
    rowCount: data.row_count,
    rows: Array.isArray(data.rows) ? data.rows : [],
    createdAt: data.created_at,
  };
}

// ---------- History queries ----------

export async function getGscSnapshotOnOrBefore(date: string): Promise<StoredGscSnapshot | null> {
  const supabase: SupabaseClient = getSupabaseAdminClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("seo_gsc_snapshots")
    .select("*")
    .lte("snapshot_date", date)
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    logSeo("SNAPSHOT_HISTORY_QUERY_FAILED", { provider: "gsc", date, reason: error.message });
    return null;
  }
  return data ? mapGscRow(data) : null;
}

export async function getGa4SnapshotOnOrBefore(date: string): Promise<StoredGa4Snapshot | null> {
  const supabase: SupabaseClient = getSupabaseAdminClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("seo_ga4_snapshots")
    .select("*")
    .lte("snapshot_date", date)
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    logSeo("SNAPSHOT_HISTORY_QUERY_FAILED", { provider: "ga4", date, reason: error.message });
    return null;
  }
  return data ? mapGa4Row(data) : null;
}

export async function listGscSnapshotsBetween(
  startDate: string,
  endDate: string,
): Promise<StoredGscSnapshot[]> {
  const supabase: SupabaseClient = getSupabaseAdminClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("seo_gsc_snapshots")
    .select("*")
    .gte("snapshot_date", startDate)
    .lte("snapshot_date", endDate)
    .order("snapshot_date", { ascending: true })
    .limit(120);
  if (error) {
    logSeo("SNAPSHOT_HISTORY_QUERY_FAILED", { provider: "gsc", startDate, endDate, reason: error.message });
    return [];
  }
  return (data ?? []).map(mapGscRow);
}

export async function listGa4SnapshotsBetween(
  startDate: string,
  endDate: string,
): Promise<StoredGa4Snapshot[]> {
  const supabase: SupabaseClient = getSupabaseAdminClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("seo_ga4_snapshots")
    .select("*")
    .gte("snapshot_date", startDate)
    .lte("snapshot_date", endDate)
    .order("snapshot_date", { ascending: true })
    .limit(120);
  if (error) {
    logSeo("SNAPSHOT_HISTORY_QUERY_FAILED", { provider: "ga4", startDate, endDate, reason: error.message });
    return [];
  }
  return (data ?? []).map(mapGa4Row);
}

// ---------- Deterministic comparison helpers ----------

export type Delta = {
  current: number;
  previous: number | null;
  absolute: number | null;
  percent: number | null;
};

function computeDelta(current: number, previous: number | null): Delta {
  if (previous == null || !Number.isFinite(previous)) {
    return { current, previous: null, absolute: null, percent: null };
  }
  const absolute = current - previous;
  const percent = previous === 0 ? null : absolute / previous;
  return { current, previous, absolute, percent };
}

function gscTotals(snapshot: StoredGscSnapshot | null): { clicks: number; impressions: number } | null {
  if (!snapshot) return null;
  return snapshot.rows.reduce(
    (acc, r) => ({ clicks: acc.clicks + r.clicks, impressions: acc.impressions + r.impressions }),
    { clicks: 0, impressions: 0 },
  );
}

function ga4Totals(snapshot: StoredGa4Snapshot | null): { sessions: number; totalUsers: number } | null {
  if (!snapshot) return null;
  return snapshot.rows.reduce(
    (acc, r) => ({ sessions: acc.sessions + r.sessions, totalUsers: acc.totalUsers + r.totalUsers }),
    { sessions: 0, totalUsers: 0 },
  );
}

export type GscDeltaSet = {
  basis: "previous" | "7d" | "30d";
  comparedAt: string | null;
  clicks: Delta;
  impressions: Delta;
};

export type Ga4DeltaSet = {
  basis: "previous" | "7d" | "30d";
  comparedAt: string | null;
  sessions: Delta;
  totalUsers: Delta;
};

export type SnapshotHistoryReport = {
  gsc: {
    available: boolean;
    current: StoredGscSnapshot | null;
    deltas: GscDeltaSet[];
  };
  ga4: {
    available: boolean;
    current: StoredGa4Snapshot | null;
    deltas: Ga4DeltaSet[];
  };
};

async function gscDeltaForBasis(
  current: StoredGscSnapshot,
  basis: GscDeltaSet["basis"],
  comparison: StoredGscSnapshot | null,
): Promise<GscDeltaSet> {
  const c = gscTotals(current)!;
  const p = gscTotals(comparison);
  return {
    basis,
    comparedAt: comparison?.snapshotDate ?? null,
    clicks: computeDelta(c.clicks, p?.clicks ?? null),
    impressions: computeDelta(c.impressions, p?.impressions ?? null),
  };
}

async function ga4DeltaForBasis(
  current: StoredGa4Snapshot,
  basis: Ga4DeltaSet["basis"],
  comparison: StoredGa4Snapshot | null,
): Promise<Ga4DeltaSet> {
  const c = ga4Totals(current)!;
  const p = ga4Totals(comparison);
  return {
    basis,
    comparedAt: comparison?.snapshotDate ?? null,
    sessions: computeDelta(c.sessions, p?.sessions ?? null),
    totalUsers: computeDelta(c.totalUsers, p?.totalUsers ?? null),
  };
}

/** Compose previous-day / 7d / 30d comparisons. Missing history is `null`. */
export async function buildSnapshotHistoryReport(
  currentGsc: StoredGscSnapshot | null,
  currentGa4: StoredGa4Snapshot | null,
): Promise<SnapshotHistoryReport> {
  const gscDeltas: GscDeltaSet[] = [];
  const ga4Deltas: Ga4DeltaSet[] = [];

  if (currentGsc) {
    // "previous" = the snapshot immediately before the current one.
    const beforeCurrent = isoDateNDaysAgo(0); // today
    const prev = await getGscSnapshotOnOrBefore(
      shiftDate(currentGsc.snapshotDate, -1),
    );
    const sevenDayBasis = shiftDate(currentGsc.snapshotDate, -7);
    const thirtyDayBasis = shiftDate(currentGsc.snapshotDate, -30);
    const [sevenAgo, thirtyAgo] = await Promise.all([
      getGscSnapshotOnOrBefore(sevenDayBasis),
      getGscSnapshotOnOrBefore(thirtyDayBasis),
    ]);
    // (beforeCurrent retained for clarity, no other use here)
    void beforeCurrent;
    gscDeltas.push(await gscDeltaForBasis(currentGsc, "previous", prev));
    gscDeltas.push(await gscDeltaForBasis(currentGsc, "7d", sevenAgo));
    gscDeltas.push(await gscDeltaForBasis(currentGsc, "30d", thirtyAgo));
  }

  if (currentGa4) {
    const prev = await getGa4SnapshotOnOrBefore(shiftDate(currentGa4.snapshotDate, -1));
    const sevenDayBasis = shiftDate(currentGa4.snapshotDate, -7);
    const thirtyDayBasis = shiftDate(currentGa4.snapshotDate, -30);
    const [sevenAgo, thirtyAgo] = await Promise.all([
      getGa4SnapshotOnOrBefore(sevenDayBasis),
      getGa4SnapshotOnOrBefore(thirtyDayBasis),
    ]);
    ga4Deltas.push(await ga4DeltaForBasis(currentGa4, "previous", prev));
    ga4Deltas.push(await ga4DeltaForBasis(currentGa4, "7d", sevenAgo));
    ga4Deltas.push(await ga4DeltaForBasis(currentGa4, "30d", thirtyAgo));
  }

  return {
    gsc: { available: Boolean(currentGsc), current: currentGsc, deltas: gscDeltas },
    ga4: { available: Boolean(currentGa4), current: currentGa4, deltas: ga4Deltas },
  };
}

function shiftDate(isoDate: string, deltaDays: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return isoDate;
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

// ---------- Trend series for sparkline-style charts ----------

export type SeriesPoint = {
  snapshotDate: string;
  value: number;
};

export type TrendSeries = {
  metric: string;
  points: SeriesPoint[];
};

export function gscTrend(
  snapshots: StoredGscSnapshot[],
  metric: "clicks" | "impressions",
): TrendSeries {
  return {
    metric,
    points: snapshots.map((s) => ({
      snapshotDate: s.snapshotDate,
      value: s.rows.reduce((sum, r) => sum + r[metric], 0),
    })),
  };
}

export function ga4Trend(
  snapshots: StoredGa4Snapshot[],
  metric: "sessions" | "totalUsers",
): TrendSeries {
  return {
    metric,
    points: snapshots.map((s) => ({
      snapshotDate: s.snapshotDate,
      value: s.rows.reduce((sum, r) => sum + r[metric], 0),
    })),
  };
}
