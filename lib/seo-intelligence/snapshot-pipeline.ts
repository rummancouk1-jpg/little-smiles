// Snapshot pipeline orchestrator. Fetches GSC + GA4 in parallel, persists
// each independently, prunes retention, and returns a structured summary
// the cron route can write to the audit log verbatim.
//
// Partial failures are first-class: if GSC succeeds but GA4 fails, we
// still persist the GSC snapshot and report the GA4 failure honestly.

import { fetchTopPagePaths, getGa4ConnectionState } from "@/lib/providers/ga4";
import { fetchTopQueries, getSearchConsoleConnectionState } from "@/lib/providers/search-console";

import {
  pruneOldGa4Snapshots,
  pruneOldGscSnapshots,
  upsertGa4Snapshot,
  upsertGscSnapshot,
} from "@/lib/seo-intelligence/snapshots-store";

const WINDOW_DAYS = 28;

export type ProviderOutcome =
  | { ok: true; rowCount: number; snapshotDate: string; windowStart: string; windowEnd: string; prunedOldRows: number }
  | { ok: false; reason: string; skipped: boolean };

export type SnapshotRunSummary = {
  startedAt: string;
  finishedAt: string;
  windowStart: string;
  windowEnd: string;
  gsc: ProviderOutcome;
  ga4: ProviderOutcome;
  status: "ok" | "partial" | "failed" | "skipped";
};

function isoDateNDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

async function runGscLeg(windowStart: string, windowEnd: string): Promise<ProviderOutcome> {
  const state = getSearchConsoleConnectionState();
  if (!state.connected) {
    return { ok: false, reason: state.reason, skipped: true };
  }

  const fetchResult = await fetchTopQueries({ startDate: windowStart, endDate: windowEnd });
  if (!fetchResult.ok) {
    return { ok: false, reason: fetchResult.reason, skipped: false };
  }

  try {
    const stored = await upsertGscSnapshot(fetchResult.window);
    const prunedOldRows = await pruneOldGscSnapshots().catch(() => 0);
    return {
      ok: true,
      rowCount: stored.rowCount,
      snapshotDate: stored.snapshotDate,
      windowStart: stored.windowStart,
      windowEnd: stored.windowEnd,
      prunedOldRows,
    };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "Persist failed", skipped: false };
  }
}

async function runGa4Leg(windowStart: string, windowEnd: string): Promise<ProviderOutcome> {
  const state = getGa4ConnectionState();
  if (!state.connected) {
    return { ok: false, reason: state.reason, skipped: true };
  }

  const fetchResult = await fetchTopPagePaths({ startDate: windowStart, endDate: windowEnd });
  if (!fetchResult.ok) {
    return { ok: false, reason: fetchResult.reason, skipped: false };
  }

  try {
    const stored = await upsertGa4Snapshot(fetchResult.window);
    const prunedOldRows = await pruneOldGa4Snapshots().catch(() => 0);
    return {
      ok: true,
      rowCount: stored.rowCount,
      snapshotDate: stored.snapshotDate,
      windowStart: stored.windowStart,
      windowEnd: stored.windowEnd,
      prunedOldRows,
    };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "Persist failed", skipped: false };
  }
}

function summariseStatus(gsc: ProviderOutcome, ga4: ProviderOutcome): SnapshotRunSummary["status"] {
  if (gsc.ok && ga4.ok) return "ok";
  if (!gsc.ok && !ga4.ok) {
    if (gsc.skipped && ga4.skipped) return "skipped";
    return "failed";
  }
  return "partial";
}

export async function runSnapshotPipeline(): Promise<SnapshotRunSummary> {
  const startedAt = new Date().toISOString();
  // 28-day window ending YESTERDAY. GSC has a 1–3 day data lag at Google's
  // end so the most recent day in this window may have zero rows — that's
  // expected, not a defect.
  const windowStart = isoDateNDaysAgo(WINDOW_DAYS);
  const windowEnd = isoDateNDaysAgo(1);

  const [gsc, ga4] = await Promise.all([runGscLeg(windowStart, windowEnd), runGa4Leg(windowStart, windowEnd)]);

  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    windowStart,
    windowEnd,
    gsc,
    ga4,
    status: summariseStatus(gsc, ga4),
  };
}
