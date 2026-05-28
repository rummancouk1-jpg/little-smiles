// Publish-readiness banner. Single source of truth = the PublishSafetyScore
// verdict. The banner used to compute its own ready/not-ready conclusion
// from the badge list, which let it disagree with the PublishSafetyCard
// (e.g. "Not ready" banner sitting under a "Ready" score). Now both
// surfaces read the same verdict and the labels always agree.

import Link from "next/link";

import type { DraftBadge } from "@/lib/contentops/draft-validation";
import {
  deriveHandoffLabels,
  type HandoffLabel,
} from "@/lib/contentops/handoff-labels";
import type { PublishSafetyVerdict } from "@/lib/contentops/publish-score";

type Props = {
  /** Source of truth for the headline label. Banner + safety card now share this. */
  verdict: PublishSafetyVerdict;
  badges: DraftBadge[];
  /** Optional secondary signals from the publish-prep engine (warning/error severity). */
  publishWarnings?: { code: string; message: string; severity: "warning" | "error" }[];
  /** Optional improvement link target — when provided, the banner shows a working "Improve draft" CTA. */
  improveHref?: string;
};

// Banner-level "issue" list — we surface the rows whose severity rises to
// at least "warning". The verdict still wins for the label; this list is
// only the "what to fix" detail.
function isSurfacedBadge(badge: DraftBadge): boolean {
  return badge.severity === "warning" || badge.severity === "critical";
}

function paletteFor(verdict: PublishSafetyVerdict): { container: string; label: string; pill: string } {
  if (verdict === "ready") {
    return {
      container: "border-[#2E6A41]/25 bg-[#EAF5EE]",
      label: "text-[#1E5A37]",
      pill: "bg-[#E7F4EA] text-[#2E6A41]",
    };
  }
  if (verdict === "needs_review") {
    return {
      container: "border-[#8A6A2F]/25 bg-[#FBF5EA]",
      label: "text-[#5E4A1C]",
      pill: "bg-[#FBEEDE] text-[#7A4A12]",
    };
  }
  return {
    container: "border-[#8A2F40]/25 bg-[#FBEEF1]",
    label: "text-[#5E1C29]",
    pill: "bg-[#F8E8EA] text-[#8A2F40]",
  };
}

function verdictHeadline(
  verdict: PublishSafetyVerdict,
  hasOpenWarnings: boolean,
): { title: string; subtitle: string } {
  if (verdict === "ready") {
    if (hasOpenWarnings) {
      // Don't claim "all checks passed" while warnings are still listed below —
      // it reads as a contradiction. Acknowledge the green light + the caveat.
      return {
        title: "Ready",
        subtitle:
          "Technically publishable — required checks pass, but soft warnings remain. Reviewing them is recommended.",
      };
    }
    return {
      title: "Ready",
      subtitle: "All required checks passed. Safe to prepare publish.",
    };
  }
  if (verdict === "needs_review") {
    return {
      title: "Needs Review",
      subtitle: "Not blocked, but improving this draft is recommended before publishing.",
    };
  }
  return {
    title: "Do Not Publish Yet",
    subtitle:
      "Do not publish yet — required image, schema, or content is missing. Fix the rows below first.",
  };
}

function handoffPillClass(tone: HandoffLabel["tone"]): string {
  if (tone === "positive") return "bg-[#E7F4EA] text-[#2E6A41]";
  if (tone === "warning") return "bg-[#FBEEDE] text-[#7A4A12]";
  if (tone === "critical") return "bg-[#F8E8EA] text-[#8A2F40]";
  return "bg-[#E7EEF7] text-[#1F3F66]";
}

export function PublishReadinessBanner({
  verdict,
  badges,
  publishWarnings = [],
  improveHref,
}: Props) {
  const surfaced = badges.filter(isSurfacedBadge);
  const errors = publishWarnings.filter((w) => w.severity === "error");
  const warnings = publishWarnings.filter((w) => w.severity === "warning");
  const hasOpenWarnings = surfaced.length > 0 || warnings.length > 0;
  const palette = paletteFor(verdict);
  const headline = verdictHeadline(verdict, hasOpenWarnings);
  const handoff = deriveHandoffLabels({ verdict, badges });

  return (
    <section className={`rounded-3xl border p-5 sm:p-6 ${palette.container}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className={`text-xs font-medium uppercase tracking-[0.16em] ${palette.label}`}>
            Readiness · {headline.title}
          </p>
          <p className="mt-1 text-sm text-[#1F1918]">{headline.subtitle}</p>
        </div>
        {handoff.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {handoff.map((label) => (
              <span
                key={label.key}
                className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${handoffPillClass(label.tone)}`}
                title={label.detail}
              >
                {label.label}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {surfaced.length > 0 || errors.length > 0 || warnings.length > 0 ? (
        <ul className="mt-3 space-y-1.5 text-sm text-[#1F1918]">
          {surfaced.map((badge) => (
            <li key={`b-${badge.key}`} className="flex items-start gap-2">
              <span
                className={`mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                  badge.severity === "critical" ? "bg-[#8A2F40]" : "bg-[#8A6A2F]"
                }`}
              />
              <div>
                <span className="font-medium">{badge.label}.</span>{" "}
                <span className="text-[#3B2F2F]/82">{badge.detail}</span>
              </div>
            </li>
          ))}
          {errors.map((w, idx) => (
            <li key={`e-${idx}`} className="flex items-start gap-2">
              <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#8A2F40]" />
              <div>
                <span className="font-medium">{w.code}.</span>{" "}
                <span className="text-[#3B2F2F]/82">{w.message}</span>
              </div>
            </li>
          ))}
          {warnings.map((w, idx) => (
            <li key={`w-${idx}`} className="flex items-start gap-2">
              <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#8A6A2F]" />
              <div>
                <span className="font-medium">{w.code}.</span>{" "}
                <span className="text-[#3B2F2F]/82">{w.message}</span>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {improveHref ? (
          <Link
            href={improveHref}
            className="rounded-full border border-[#7A4A12]/30 bg-white px-3.5 py-1.5 text-xs font-medium text-[#7A4A12] hover:bg-[#F4E2C9]"
          >
            Improve draft →
          </Link>
        ) : (
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="rounded-full border border-[#3B2F2F]/14 bg-white px-3.5 py-1.5 text-xs font-medium text-[#3B2F2F]/45"
          >
            Improve draft
          </button>
        )}
      </div>
    </section>
  );
}
