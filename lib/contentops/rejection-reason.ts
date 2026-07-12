// Compute the structured "why" recorded when a draft is rejected.
//
// At reject time we snapshot the objective checks that were failing — the
// publish-score checks plus the full quality-bar gaps (thin / too few sections
// / too little FAQ) — so the rejection carries a machine-readable reason next
// to the operator's free-text note. This is the signal the drafting pass feeds
// forward as "avoid these failure modes". Pure + deterministic.

import { validateDraft } from "@/lib/contentops/draft-validation";
import { computePublishSafetyScore } from "@/lib/contentops/publish-score";
import { assessQualityBar } from "@/lib/contentops/quality-bar";
import { type Draft, type RejectionReason, type RejectionReasonCheck } from "@/lib/contentops/drafts-store";

export function computeRejectionReason(draft: Draft): RejectionReason {
  const validation = validateDraft(draft);
  const score = computePublishSafetyScore(draft, { validation });
  const failedChecks: RejectionReasonCheck[] = [];

  // Failing publish-score checks (the objective, weighted signals).
  for (const c of score.checks) {
    if (!c.passed) {
      failedChecks.push({ key: c.key, label: c.label, detail: c.detail });
    }
  }

  // Full quality-bar gaps (length / sections / FAQ) — richer than publish-score's
  // floor, so a "thin but publish-score-100" draft still records why it fell short.
  const quality = assessQualityBar(draft);
  if (quality.belowBar) {
    failedChecks.push({
      key: "below_quality_bar",
      label: "Below quality bar",
      detail: quality.reasons.join(" · "),
    });
  }

  return {
    failedChecks,
    score: score.score,
    capturedAt: new Date().toISOString(),
  };
}
