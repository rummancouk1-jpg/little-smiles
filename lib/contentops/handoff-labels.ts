// Wife-friendly handoff labels.
//
// Translates the deterministic validation badges + the publish-safety
// verdict into a small set of short, human-readable status pills that
// say *what to do next* in non-technical language:
//
//   - "Needs more content"      → the draft is too thin
//   - "Needs metadata review"   → title / description / keywords off
//   - "Needs image review"      → no hero image resolvable
//   - "Ready for review"        → no specific blocker, but verdict isn't fully green
//   - "Technically publishable" → verdict is ready but a soft caveat exists (e.g. no internal links)
//   - "SEO-ready"               → verdict is fully ready and no caveats
//
// These pills are purely additive — they sit next to the readiness
// verdict and the per-check explanations. They never override the
// verdict; if anything they nudge the reviewer toward the right next
// screen.

import type { DraftBadge } from "@/lib/contentops/draft-validation";
import type { PublishSafetyVerdict } from "@/lib/contentops/publish-score";

export type HandoffLabelKey =
  | "needs_more_content"
  | "needs_metadata_review"
  | "needs_image_review"
  | "ready_for_review"
  | "technically_publishable"
  | "seo_ready";

export type HandoffLabel = {
  key: HandoffLabelKey;
  label: string;
  detail: string;
  tone: "positive" | "info" | "warning" | "critical";
};

function hasBadge(badges: DraftBadge[], key: DraftBadge["key"]): boolean {
  return badges.some(
    (b) => b.key === key && b.severity !== "ok" && b.severity !== "info",
  );
}

function hasInfoBadge(badges: DraftBadge[], key: DraftBadge["key"]): boolean {
  return badges.some((b) => b.key === key);
}

export function deriveHandoffLabels(input: {
  verdict: PublishSafetyVerdict;
  badges: DraftBadge[];
}): HandoffLabel[] {
  const { verdict, badges } = input;
  const labels: HandoffLabel[] = [];

  // Issue-specific labels. These dominate when present — they tell the
  // reviewer exactly which screen to head to next.
  if (hasBadge(badges, "thin_content")) {
    labels.push({
      key: "needs_more_content",
      label: "Needs more content",
      detail: "Word count or section count below the recommended floor — open Improve to expand.",
      tone: "warning",
    });
  }
  if (hasBadge(badges, "missing_metadata")) {
    labels.push({
      key: "needs_metadata_review",
      label: "Needs metadata review",
      detail: "Title, description, or keywords are out of the recommended band.",
      tone: "warning",
    });
  }
  if (hasBadge(badges, "missing_hero_image")) {
    labels.push({
      key: "needs_image_review",
      label: "Needs image review",
      detail: "No hero image will render — pick one in the Hero image panel or change the category.",
      tone: "warning",
    });
  }

  // No specific blockers, but the publish-safety verdict still says the
  // draft isn't fully green. Surface that with the gentler "Ready for
  // review" label so the reviewer knows to open the safety card.
  if (labels.length === 0 && verdict === "needs_review") {
    labels.push({
      key: "ready_for_review",
      label: "Ready for review",
      detail: "No structural blockers — open the safety card to see which soft warnings remain.",
      tone: "info",
    });
  }

  // Verdict is fully ready — split into two tones depending on whether
  // there's still an informational badge (e.g. "no internal links") sitting
  // around. "SEO-ready" is the strongest signal; "Technically publishable"
  // is the same green-light but with a small caveat.
  if (labels.length === 0 && verdict === "ready") {
    const hasInternalLinkInfo = hasInfoBadge(badges, "missing_internal_links");
    if (hasInternalLinkInfo) {
      labels.push({
        key: "technically_publishable",
        label: "Technically publishable",
        detail: "All required checks pass, but adding an internal link will strengthen the post.",
        tone: "positive",
      });
    } else {
      labels.push({
        key: "seo_ready",
        label: "SEO-ready",
        detail: "All required checks pass and no caveats — safe to publish when convenient.",
        tone: "positive",
      });
    }
  }

  // Verdict is do_not_publish_yet and we did not match a specific badge
  // (e.g. schema or slug-collision blocker). Fall back to the gentler
  // "Ready for review" so non-technical reviewers don't see an empty pill
  // strip on a red banner.
  if (labels.length === 0 && verdict === "do_not_publish_yet") {
    labels.push({
      key: "ready_for_review",
      label: "Ready for review",
      detail: "A blocking issue exists — open the safety card to see exactly what's wrong.",
      tone: "critical",
    });
  }

  return labels;
}
