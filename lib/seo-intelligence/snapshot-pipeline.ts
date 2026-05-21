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
  status: "ok" | "completed_with_warnings" | "skipped";
  warnings: string[];
};

/** Strip key material and cap length before surfacing provider errors in API responses. */
function sanitizeProviderReason(reason: string): string {
  let s = reason.trim();
  s = s.replace(/-----BEGIN[\s\S]*?-----END[^-]*-----/gi, "[redacted]");
  s = s.replace(/\b(private[_\s-]?key|client_email|Bearer\s+)\S+/gi, "[redacted]");
  if (s.length > 300) {
    s = `${s.slice(0, 297)}...`;
  }
  return s;
}

function providerFailureMessage(label: "GSC" | "GA4", reason: string): string {
  return `${label} unavailable: ${sanitizeProviderReason(reason)}`;
}

function buildWarnings(gsc: ProviderOutcome, ga4: ProviderOutcome): string[] {
  const warnings: string[] = [];
  if (!gsc.ok && !gsc.skipped) {
    warnings.push(providerFailureMessage("GSC", gsc.reason));
  }
  if (!ga4.ok && !ga4.skipped) {
    warnings.push(providerFailureMessage("GA4", ga4.reason));
  }
  return warnings;
}

function isoDateNDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

async function runGscLeg(windowStart: string, windowEnd: string): Promise<ProviderOutcome> {
  try {
    const state = getSearchConsoleConnectionState();
    if (!state.connected) {
      return { ok: false, reason: state.reason, skipped: true };
    }

    let fetchResult;
    try {
      fetchResult = await fetchTopQueries({ startDate: windowStart, endDate: windowEnd });
    } catch (err) {
      return {
        ok: false,
        reason: err instanceof Error ? err.message : "Search Console fetch failed",
        skipped: false,
      };
    }

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
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "Search Console leg failed",
      skipped: false,
    };
  }
}

async function runGa4Leg(windowStart: string, windowEnd: string): Promise<ProviderOutcome> {
  try {
    const state = getGa4ConnectionState();
    if (!state.connected) {
      return { ok: false, reason: state.reason, skipped: true };
    }

    let fetchResult;
    try {
      fetchResult = await fetchTopPagePaths({ startDate: windowStart, endDate: windowEnd });
    } catch (err) {
      return {
        ok: false,
        reason: err instanceof Error ? err.message : "GA4 fetch failed",
        skipped: false,
      };
    }

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
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "GA4 leg failed",
      skipped: false,
    };
  }
}

function isSkippedLeg(outcome: ProviderOutcome): boolean {
  return !outcome.ok && outcome.skipped;
}

function summariseStatus(
  gsc: ProviderOutcome,
  ga4: ProviderOutcome,
  warnings: string[],
): SnapshotRunSummary["status"] {
  if (gsc.ok && ga4.ok) return "ok";
  if (isSkippedLeg(gsc) && isSkippedLeg(ga4)) return "skipped";
  if (warnings.length > 0) return "completed_with_warnings";
  return "ok";
}

export async function runSnapshotPipeline(): Promise<SnapshotRunSummary> {
  const startedAt = new Date().toISOString();
  // 28-day window ending YESTERDAY. GSC has a 1–3 day data lag at Google's
  // end so the most recent day in this window may have zero rows — that's
  // expected, not a defect.
  const windowStart = isoDateNDaysAgo(WINDOW_DAYS);
  const windowEnd = isoDateNDaysAgo(1);

  const [gsc, ga4] = await Promise.all([runGscLeg(windowStart, windowEnd), runGa4Leg(windowStart, windowEnd)]);
  const warnings = buildWarnings(gsc, ga4);

  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    windowStart,
    windowEnd,
    gsc,
    ga4,
    warnings,
    status: summariseStatus(gsc, ga4, warnings),
  };
}
