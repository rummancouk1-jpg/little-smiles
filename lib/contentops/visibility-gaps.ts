// Visibility-gap consumer — reads OperatorHQ's persistent-gap feed and turns each gap into a proposed topic
// opportunity (Phase 3 of the AI-search-visibility loop, ContentOps side).
//
// Cross-repo contract (the SAME file-drop pattern Video uses): OperatorHQ writes
// ../OperatorHQ AI/.competitor-inbox/visibility-gaps.littlesmiles.v1.json listing ONLY the persistently-invisible
// queries (streak ≥ N — the noise filter lives in OperatorHQ, so a one-scan blip never reaches this queue). We
// read it fail-closed and expose the gaps as ranked opportunities that appear in the "Suggested gaps to cover"
// panel, each carrying provenance so the reviewer sees WHY. This PROPOSES only — a human still approves + edits.
// Fail-closed to [] (absent / stale / malformed → no gap suggestions, panel behaves exactly as before).

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { VISIBILITY_GAP_SOURCE, type TopicProvenance } from "@/lib/contentops/topic-provenance";

const GAP_FEED_SCHEMA = "operatorhq.visibility-gaps.v1";
const DEFAULT_MAX_AGE_MS = 45 * 24 * 60 * 60 * 1000; // ignore a feed older than ~6 weeks (don't propose on stale data)
// Defense-in-depth: OperatorHQ's feed already contains ONLY persistent gaps (streak ≥ N), but we re-assert the
// floor here so a malformed/old-schema feed can never inject a sub-threshold (noisy) query into the queue.
// Mirrors OperatorHQ's PERSISTENTLY_INVISIBLE_MIN_STREAK (3).
export const MIN_GAP_STREAK = 3;

export type VisibilityGapOpportunity = {
  query: string;
  streak: number;
  competitors: string[];
  generatedAt?: string;
};

/** Resolve the gap-feed path: an explicit override, else the sibling OHQ littlesmiles feed. */
export function visibilityGapsPath(): string {
  const override = process.env.CONTENTOPS_VISIBILITY_GAPS_PATH?.trim();
  if (override) return override;
  return path.resolve(process.cwd(), "..", "OperatorHQ AI", ".competitor-inbox", "visibility-gaps.littlesmiles.v1.json");
}

/** PURE: validate + destale a gap-feed payload → gap opportunities (or [] on anything off). Fail-closed. */
export function parseVisibilityGaps(raw: unknown, nowMs: number, maxAgeMs = DEFAULT_MAX_AGE_MS): VisibilityGapOpportunity[] {
  if (!raw || typeof raw !== "object") return [];
  const s = raw as Record<string, unknown>;
  if (s.schema !== GAP_FEED_SCHEMA || !Array.isArray(s.gaps)) return [];
  const at = typeof s.generatedAt === "string" ? new Date(s.generatedAt).getTime() : NaN;
  if (!Number.isFinite(at) || nowMs - at > maxAgeMs) return []; // missing/old timestamp → don't propose on stale data
  const generatedAt = typeof s.generatedAt === "string" ? s.generatedAt : undefined;
  const out: VisibilityGapOpportunity[] = [];
  for (const g of s.gaps) {
    if (!g || typeof g !== "object") continue;
    const r = g as Record<string, unknown>;
    const query = typeof r.query === "string" ? r.query.trim() : "";
    if (!query) continue;
    const streak = Number(r.streak);
    if (!Number.isFinite(streak) || streak < MIN_GAP_STREAK) continue; // defense-in-depth: only persistent gaps
    const competitors = Array.isArray(r.competitors) ? r.competitors.filter((c): c is string => typeof c === "string") : [];
    out.push({ query, streak, competitors, generatedAt });
  }
  return out.slice(0, 12);
}

/** Read the visibility-gap opportunities, or [] if absent/stale/unreadable. `nowMs`/read injectable for tests. */
export function readVisibilityGaps(
  deps: { nowMs?: number; read?: (p: string) => string; exists?: (p: string) => boolean } = {},
): VisibilityGapOpportunity[] {
  const p = visibilityGapsPath();
  const exists = deps.exists ?? existsSync;
  const read = deps.read ?? ((f: string) => readFileSync(f, "utf-8"));
  const nowMs = deps.nowMs ?? Date.now();
  try {
    if (!exists(p)) return [];
    return parseVisibilityGaps(JSON.parse(read(p)), nowMs);
  } catch {
    return [];
  }
}

/** The provenance object a gap opportunity carries downstream to the chip + the draft. */
export function gapProvenance(gap: VisibilityGapOpportunity): TopicProvenance {
  return {
    source: VISIBILITY_GAP_SOURCE,
    visibilityStreak: gap.streak,
    competitorsCited: gap.competitors,
    generatedAt: gap.generatedAt,
  };
}
