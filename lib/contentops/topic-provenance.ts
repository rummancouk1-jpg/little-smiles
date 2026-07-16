// Topic provenance — where a draft's topic came from (Phase 3 of the AI-search-visibility loop).
//
// A gap-sourced suggestion must stay visibly labelled all the way to the reviewer, so the human at the approval
// gate knows WHY this topic is here (a proposal whose origin is invisible gets rubber-stamped). This threads a
// small, additive `provenance` object through: opportunity → suggestion chip → generate request → the draft's
// content JSON. It is metadata only — it never influences generation truth or bypasses any gate.

import { z } from "zod";

/** The only non-organic source today: a persistently-invisible AI-search query (streak ≥ N in OperatorHQ). */
export const VISIBILITY_GAP_SOURCE = "visibility_gap" as const;

export const topicProvenanceSchema = z.object({
  source: z.literal(VISIBILITY_GAP_SOURCE),
  /** Consecutive scans this query has been a gap (we're not cited, a competitor is). */
  visibilityStreak: z.number().int().nonnegative(),
  /** Who IS cited on this query right now — shown to the reviewer as competitive context. */
  competitorsCited: z.array(z.string()),
  /** When the source gap feed was generated (ISO). */
  generatedAt: z.string().optional(),
});

export type TopicProvenance = z.infer<typeof topicProvenanceSchema>;

/** Parse an unknown provenance payload (from a request body) → a valid TopicProvenance, or null. Fail-safe. */
export function parseTopicProvenance(raw: unknown): TopicProvenance | null {
  const result = topicProvenanceSchema.safeParse(raw);
  return result.success ? result.data : null;
}
