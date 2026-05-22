// Persistence layer for SEO snapshots. Pure Supabase read/write helpers.
// Upsert by snapshot_date for natural deduplication. Retention is
// time-bounded — anything older than RETENTION_DAYS is pruned during the
// same cron pass that wrote the new snapshot.
//
// Retention is intentionally wider than the longest comparison window
// (30 days) so the snapshot-history layer can resolve "vs. 30 days ago"
// without a cold cache.

import type { Ga4PagePathRow, Ga4PagePathWindow } from "@/lib/providers/ga4";
import type { GscQueryRow, GscQueryWindow } from "@/lib/providers/search-console";
import { logSeo } from "@/lib/seo-intelligence/logger";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const RETENTION_DAYS = 90;

function requireClient() {
  const client = getSupabaseAdminClient();
  if (!client) {
    throw new Error("Supabase admin client is not configured.");
  }
  return client;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function retentionCutoffIso(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - RETENTION_DAYS);
  return d.toISOString().slice(0, 10);
}

// ---------- GSC ----------

export type StoredGscSnapshot = {
  id: string;
  snapshotDate: string;
  windowStart: string;
  windowEnd: string;
  rowCount: number;
  rows: GscQueryRow[];
  createdAt: string;
};

export async function upsertGscSnapshot(window: GscQueryWindow): Promise<StoredGscSnapshot> {
  const supabase = requireClient();
  const snapshot_date = todayIso();
  const { data, error } = await supabase
    .from("seo_gsc_snapshots")
    .upsert(
      {
        snapshot_date,
        window_start: window.startDate,
        window_end: window.endDate,
        rows: window.rows,
        row_count: window.rows.length,
      },
      { onConflict: "snapshot_date" },
    )
    .select("*")
    .single();

  if (error || !data) {
    logSeo("GSC_SUPABASE_WRITE_FAILED", {
      reason: error?.message ?? "no row returned",
      snapshotDate: snapshot_date,
    });
    throw new Error(`Failed to upsert GSC snapshot: ${error?.message ?? "no row returned"}`);
  }

  logSeo("GSC_SUPABASE_WRITE_SUCCESS", {
    snapshotDate: data.snapshot_date,
    rowCount: data.row_count,
    windowStart: data.window_start,
    windowEnd: data.window_end,
  });

  return {
    id: data.id,
    snapshotDate: data.snapshot_date,
    windowStart: data.window_start,
    windowEnd: data.window_end,
    rowCount: data.row_count,
    rows: data.rows,
    createdAt: data.created_at,
  };
}

export async function getLatestGscSnapshot(): Promise<StoredGscSnapshot | null> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from("seo_gsc_snapshots")
    .select("*")
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to read latest GSC snapshot: ${error.message}`);
  }
  if (!data) return null;
  return {
    id: data.id,
    snapshotDate: data.snapshot_date,
    windowStart: data.window_start,
    windowEnd: data.window_end,
    rowCount: data.row_count,
    rows: data.rows,
    createdAt: data.created_at,
  };
}

export async function pruneOldGscSnapshots(): Promise<number> {
  const supabase = requireClient();
  const cutoff = retentionCutoffIso();
  const { count, error } = await supabase
    .from("seo_gsc_snapshots")
    .delete({ count: "exact" })
    .lt("snapshot_date", cutoff);
  if (error) {
    throw new Error(`Failed to prune GSC snapshots: ${error.message}`);
  }
  return count ?? 0;
}

// ---------- GA4 ----------

export type StoredGa4Snapshot = {
  id: string;
  snapshotDate: string;
  windowStart: string;
  windowEnd: string;
  rowCount: number;
  rows: Ga4PagePathRow[];
  createdAt: string;
};

export async function upsertGa4Snapshot(window: Ga4PagePathWindow): Promise<StoredGa4Snapshot> {
  const supabase = requireClient();
  const snapshot_date = todayIso();
  const { data, error } = await supabase
    .from("seo_ga4_snapshots")
    .upsert(
      {
        snapshot_date,
        window_start: window.startDate,
        window_end: window.endDate,
        rows: window.rows,
        row_count: window.rows.length,
      },
      { onConflict: "snapshot_date" },
    )
    .select("*")
    .single();

  if (error || !data) {
    logSeo("GA4_SUPABASE_WRITE_FAILED", {
      reason: error?.message ?? "no row returned",
      snapshotDate: snapshot_date,
    });
    throw new Error(`Failed to upsert GA4 snapshot: ${error?.message ?? "no row returned"}`);
  }

  logSeo("GA4_SUPABASE_WRITE_SUCCESS", {
    snapshotDate: data.snapshot_date,
    rowCount: data.row_count,
    windowStart: data.window_start,
    windowEnd: data.window_end,
  });

  return {
    id: data.id,
    snapshotDate: data.snapshot_date,
    windowStart: data.window_start,
    windowEnd: data.window_end,
    rowCount: data.row_count,
    rows: data.rows,
    createdAt: data.created_at,
  };
}

export async function getLatestGa4Snapshot(): Promise<StoredGa4Snapshot | null> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from("seo_ga4_snapshots")
    .select("*")
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to read latest GA4 snapshot: ${error.message}`);
  }
  if (!data) return null;
  return {
    id: data.id,
    snapshotDate: data.snapshot_date,
    windowStart: data.window_start,
    windowEnd: data.window_end,
    rowCount: data.row_count,
    rows: data.rows,
    createdAt: data.created_at,
  };
}

export async function pruneOldGa4Snapshots(): Promise<number> {
  const supabase = requireClient();
  const cutoff = retentionCutoffIso();
  const { count, error } = await supabase
    .from("seo_ga4_snapshots")
    .delete({ count: "exact" })
    .lt("snapshot_date", cutoff);
  if (error) {
    throw new Error(`Failed to prune GA4 snapshots: ${error.message}`);
  }
  return count ?? 0;
}

export function snapshotIsFresh(snapshot: { snapshotDate: string } | null, maxAgeDays: number = 2): boolean {
  if (!snapshot) return false;
  const t = new Date(`${snapshot.snapshotDate}T00:00:00Z`).getTime();
  if (!Number.isFinite(t)) return false;
  const ageDays = (Date.now() - t) / 86_400_000;
  return ageDays <= maxAgeDays;
}
