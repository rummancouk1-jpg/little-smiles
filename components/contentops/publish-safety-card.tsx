// Publish safety score card. Reads the deterministic score and renders
// the verdict + per-check breakdown. Informational only — the reviewer
// stays in control.

import type { PublishSafetyScore, PublishSafetyVerdict } from "@/lib/contentops/publish-score";

type Props = {
  score: PublishSafetyScore;
  /** When true, render the full checklist; otherwise just the verdict line. */
  showChecklist?: boolean;
};

function toneFor(verdict: PublishSafetyVerdict): { container: string; label: string; pill: string } {
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

function verdictLabel(v: PublishSafetyVerdict): string {
  if (v === "ready") return "Ready";
  if (v === "needs_review") return "Needs Review";
  return "Do Not Publish Yet";
}

export function PublishSafetyCard({ score, showChecklist = true }: Props) {
  const tone = toneFor(score.verdict);
  const failedHard = score.checks.filter((c) => !c.passed && c.hard);
  const failedSoft = score.checks.filter((c) => !c.passed && !c.hard);

  return (
    <section className={`rounded-3xl border p-5 sm:p-6 ${tone.container}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className={`text-xs font-medium uppercase tracking-[0.16em] ${tone.label}`}>
            Publish safety score
          </p>
          <p className="mt-1 text-sm text-[#1F1918]">{score.headline}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold tabular-nums ${tone.pill}`}>
            {score.score}/100
          </span>
          <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ${tone.pill}`}>
            {verdictLabel(score.verdict)}
          </span>
        </div>
      </div>

      {showChecklist ? (
        <ul className="mt-4 space-y-1.5 text-sm text-[#1F1918]">
          {failedHard.map((c) => (
            <li key={c.key} className="flex items-start gap-2">
              <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#8A2F40]" />
              <div>
                <span className="font-medium">{c.label}.</span>{" "}
                <span className="text-[#3B2F2F]/82">{c.detail}</span>
              </div>
            </li>
          ))}
          {failedSoft.map((c) => (
            <li key={c.key} className="flex items-start gap-2">
              <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#8A6A2F]" />
              <div>
                <span className="font-medium">{c.label}.</span>{" "}
                <span className="text-[#3B2F2F]/82">{c.detail}</span>
              </div>
            </li>
          ))}
          {failedHard.length === 0 && failedSoft.length === 0 ? (
            <li className="text-xs text-[#3B2F2F]/72">All checks passed.</li>
          ) : null}
        </ul>
      ) : null}
    </section>
  );
}

/**
 * Compact verdict pill — used on queue cards where space is tight.
 */
export function PublishSafetyPill({ score }: { score: PublishSafetyScore }) {
  const tone = toneFor(score.verdict);
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${tone.pill}`}
      title={score.headline}
    >
      {verdictLabel(score.verdict)} · {score.score}
    </span>
  );
}
