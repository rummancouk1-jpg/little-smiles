// Full quality-bar assessment — the INTERIM-HONESTY signal for Branch 1.
//
// Branch 1 (queue hygiene + metadata repair) can lift a draft to publish-score
// 100 by fixing mechanical metadata, but a draft can still be genuinely THIN
// (below the real length/section/FAQ bar) because the full-length expansion
// pass is Branch 2. Without this signal, a green "100" would mislead the
// operator into publishing a thin post. This assessment surfaces "below the
// quality bar — pending expansion" so the operator-facing state stays honest
// between Branch 1 and Branch 2.
//
// Thresholds are the SAME richer bar the improvement engine already uses
// (lib/contentops/improvement.ts) — not the lower publish-score floor.

import { IMPROVEMENT_TARGETS } from "@/lib/contentops/improvement";
import { validateDraft } from "@/lib/contentops/draft-validation";
import { type Draft } from "@/lib/contentops/drafts-store";

export type QualityBarAssessment = {
  /** True when the draft is below the full quality bar (thin / too few sections / too little FAQ). */
  belowBar: boolean;
  /** Short, human-readable reasons — e.g. "388 words (target ≥ 700)". */
  reasons: string[];
};

/**
 * Assess a draft against the FULL quality bar (length, sections, FAQ). Pure and
 * deterministic — mirrors improvement.ts thresholds so a draft that clears this
 * also clears the Improve screen. Until Branch 2's expansion pass exists, this
 * is what keeps a metadata-only "100" honest.
 */
export function assessQualityBar(draft: Draft): QualityBarAssessment {
  const post = draft.content;
  const { wordCount, sectionCount } = validateDraft(draft);
  const faqCount = post.faq?.length ?? 0;

  const reasons: string[] = [];
  if (wordCount < IMPROVEMENT_TARGETS.wordCountMin) {
    reasons.push(`${wordCount} words (target ≥ ${IMPROVEMENT_TARGETS.wordCountMin})`);
  }
  if (sectionCount < IMPROVEMENT_TARGETS.sectionCountMin) {
    reasons.push(`${sectionCount} sections (target ≥ ${IMPROVEMENT_TARGETS.sectionCountMin})`);
  }
  if (faqCount < IMPROVEMENT_TARGETS.faqMin) {
    reasons.push(`${faqCount} FAQ (target ≥ ${IMPROVEMENT_TARGETS.faqMin})`);
  }

  return { belowBar: reasons.length > 0, reasons };
}
