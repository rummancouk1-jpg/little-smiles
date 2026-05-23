// Draft improvement panel. Renders deterministic weaknesses and
// recommended improvements on /admin/contentops/[id]/improve. Read-only;
// the "Generate improved draft" CTA stays disabled unless explicit env
// flags allow it, and it never auto-runs.

import { DraftBriefCopyButtons } from "@/components/contentops/draft-brief-copy-buttons";
import type { DraftImprovementReport } from "@/lib/contentops/improvement";

type Props = {
  report: DraftImprovementReport;
  draftId: string;
  draftSlug: string;
  draftTitle: string;
  draftRelatedCategory: string;
};

function severityBadge(): string {
  return "bg-[#FBEEDE] text-[#7A4A12]";
}

export function DraftImprovementPanel({
  report,
  draftId,
  draftSlug,
  draftTitle,
  draftRelatedCategory,
}: Props) {
  const { validation, weaknesses, recommendation, aiGenerationAvailable, aiGenerationDisabledReason } = report;

  return (
    <section className="space-y-6">
      <article className="rounded-3xl border border-[#3B2F2F]/10 bg-white/90 p-5 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#3B2F2F]/55">
              Improvement plan
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[#1F1918]">{draftSlug}</h2>
            <p className="mt-1 text-xs text-[#3B2F2F]/65">
              {validation.wordCount} words · {validation.sectionCount} sections ·{" "}
              {validation.internalLinkCount} internal link(s)
            </p>
          </div>
          <span
            className={[
              "inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide",
              weaknesses.length === 0
                ? "bg-[#E7F4EA] text-[#2E6A41]"
                : "bg-[#FBEEDE] text-[#7A4A12]",
            ].join(" ")}
          >
            {weaknesses.length === 0 ? "No improvements needed" : `${weaknesses.length} weakness(es)`}
          </span>
        </header>
      </article>

      <article className="rounded-3xl border border-[#3B2F2F]/10 bg-white/90 p-5 sm:p-6">
        <h3 className="text-base font-semibold text-[#1F1918]">Five-step plan</h3>
        <p className="mt-1 text-xs text-[#3B2F2F]/65">
          The whole improvement loop, in plain language. Work top-to-bottom — Prepare publish stays grey until the first
          four are green.
        </p>
        <ol className="mt-3 space-y-2">
          {report.simpleChecklist.map((step) => {
            const tone =
              step.status === "done"
                ? "bg-[#E7F4EA] text-[#2E6A41]"
                : "bg-[#FBEEDE] text-[#7A4A12]";
            return (
              <li
                key={step.key}
                className="flex items-start gap-3 rounded-2xl border border-[#3B2F2F]/10 bg-[#FDF8F4] p-3"
              >
                <span
                  className={[
                    "mt-0.5 inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                    tone,
                  ].join(" ")}
                >
                  {step.status === "done" ? "OK" : "Do this"}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#1F1918]">{step.label}</p>
                  <p className="mt-0.5 text-xs text-[#3B2F2F]/72">{step.detail}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </article>

      {weaknesses.length > 0 ? (
        <article className="rounded-3xl border border-[#3B2F2F]/10 bg-white/90 p-5 sm:p-6">
          <h3 className="text-base font-semibold text-[#1F1918]">Current weaknesses</h3>
          <ul className="mt-3 space-y-2">
            {weaknesses.map((w) => (
              <li key={w.key} className="flex items-start gap-3">
                <span
                  className={[
                    "mt-0.5 inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                    severityBadge(),
                  ].join(" ")}
                >
                  fix
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#1F1918]">{w.label}</p>
                  <p className="mt-0.5 text-xs text-[#3B2F2F]/72">{w.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </article>
      ) : null}

      <article className="rounded-3xl border border-[#3B2F2F]/10 bg-white/90 p-5 sm:p-6">
        <h3 className="text-base font-semibold text-[#1F1918]">Targets</h3>
        <dl className="mt-3 grid gap-3 text-xs text-[#3B2F2F]/82 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-[#3B2F2F]/10 bg-[#FDF8F4] p-3">
            <dt className="text-[11px] uppercase tracking-wide text-[#3B2F2F]/55">Word count</dt>
            <dd className="mt-0.5 text-base font-semibold text-[#1F1918]">
              {recommendation.targets.wordCountMin}–{recommendation.targets.wordCountMax}
            </dd>
          </div>
          <div className="rounded-2xl border border-[#3B2F2F]/10 bg-[#FDF8F4] p-3">
            <dt className="text-[11px] uppercase tracking-wide text-[#3B2F2F]/55">Sections</dt>
            <dd className="mt-0.5 text-base font-semibold text-[#1F1918]">
              {recommendation.targets.sectionCountMin}–{recommendation.targets.sectionCountMax}
            </dd>
          </div>
          <div className="rounded-2xl border border-[#3B2F2F]/10 bg-[#FDF8F4] p-3">
            <dt className="text-[11px] uppercase tracking-wide text-[#3B2F2F]/55">FAQs (if relevant)</dt>
            <dd className="mt-0.5 text-base font-semibold text-[#1F1918]">
              {recommendation.targets.faqMin}–{recommendation.targets.faqMax}
            </dd>
          </div>
          <div className="rounded-2xl border border-[#3B2F2F]/10 bg-[#FDF8F4] p-3">
            <dt className="text-[11px] uppercase tracking-wide text-[#3B2F2F]/55">Internal links</dt>
            <dd className="mt-0.5 text-base font-semibold text-[#1F1918]">
              ≥ {recommendation.targets.internalLinkMin}
            </dd>
          </div>
        </dl>
      </article>

      {recommendation.suggestedSections.length > 0 ? (
        <article className="rounded-3xl border border-[#3B2F2F]/10 bg-white/90 p-5 sm:p-6">
          <h3 className="text-base font-semibold text-[#1F1918]">Suggested new sections</h3>
          <ul className="mt-3 space-y-2">
            {recommendation.suggestedSections.map((s) => (
              <li key={s.heading} className="rounded-2xl border border-[#3B2F2F]/10 bg-[#FDF8F4] p-3">
                <p className="text-sm font-medium text-[#1F1918]">{s.heading}</p>
                <p className="mt-0.5 text-xs text-[#3B2F2F]/72">{s.rationale}</p>
              </li>
            ))}
          </ul>
        </article>
      ) : null}

      {recommendation.suggestedFaqs.length > 0 ? (
        <article className="rounded-3xl border border-[#3B2F2F]/10 bg-white/90 p-5 sm:p-6">
          <h3 className="text-base font-semibold text-[#1F1918]">Suggested FAQ questions</h3>
          <ul className="mt-3 space-y-2">
            {recommendation.suggestedFaqs.map((q) => (
              <li key={q.question} className="rounded-2xl border border-[#3B2F2F]/10 bg-[#FDF8F4] p-3">
                <p className="text-sm font-medium text-[#1F1918]">{q.question}</p>
                <p className="mt-0.5 text-xs text-[#3B2F2F]/72">{q.rationale}</p>
              </li>
            ))}
          </ul>
        </article>
      ) : null}

      {recommendation.suggestedInternalLinks.length > 0 ? (
        <article className="rounded-3xl border border-[#3B2F2F]/10 bg-white/90 p-5 sm:p-6">
          <h3 className="text-base font-semibold text-[#1F1918]">Suggested internal links</h3>
          <ul className="mt-3 space-y-2">
            {recommendation.suggestedInternalLinks.map((l, idx) => (
              <li key={`${l.toKind}-${l.toSlugOrCategory}-${idx}`} className="rounded-2xl border border-[#3B2F2F]/10 bg-[#FDF8F4] p-3">
                <p className="text-sm font-medium text-[#1F1918]">
                  {l.toTitle}{" "}
                  <span className="ml-1 rounded-full bg-[#EEE4DB] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[#3B2F2F]/70">
                    {l.toKind}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-[#3B2F2F]/72">
                  Suggested anchor: <span className="font-medium text-[#1F1918]">{l.suggestedAnchor}</span>
                </p>
                <p className="mt-0.5 text-xs text-[#3B2F2F]/65">{l.reason}</p>
              </li>
            ))}
          </ul>
        </article>
      ) : null}

      {recommendation.suggestedProductCta ? (
        <article className="rounded-3xl border border-[#3B2F2F]/10 bg-white/90 p-5 sm:p-6">
          <h3 className="text-base font-semibold text-[#1F1918]">Recommended product CTA</h3>
          <p className="mt-2 text-sm text-[#1F1918]">
            <span className="font-medium">{recommendation.suggestedProductCta.name}</span>{" "}
            <span className="text-xs font-mono text-[#3B2F2F]/65">/shop/{recommendation.suggestedProductCta.slug}</span>
          </p>
          <p className="mt-1 text-xs text-[#3B2F2F]/72">{recommendation.suggestedProductCta.reason}</p>
        </article>
      ) : null}

      {recommendation.nextActions.length > 0 ? (
        <article className="rounded-3xl border border-[#3B2F2F]/10 bg-white/90 p-5 sm:p-6">
          <h3 className="text-base font-semibold text-[#1F1918]">Detailed next actions, in order</h3>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-[#1F1918]">
            {recommendation.nextActions.map((a, idx) => (
              <li key={idx}>{a}</li>
            ))}
          </ol>
        </article>
      ) : null}

      <DraftBriefCopyButtons
        report={report}
        draftId={draftId}
        draftTitle={draftTitle}
        draftSlug={draftSlug}
        draftRelatedCategory={draftRelatedCategory}
      />

      <article className="rounded-3xl border border-[#3B2F2F]/10 bg-white/90 p-5 sm:p-6">
        <h3 className="text-base font-semibold text-[#1F1918]">Assisted draft improvement</h3>
        <p className="mt-2 text-xs text-[#3B2F2F]/72">
          The button below is intentionally inert in this build. AI-assisted rewriting will only run when both
          ANTHROPIC_API_KEY and CONTENTOPS_IMPROVE_ENABLED=1 are configured, and even then it stays a manual,
          per-draft action — never automatic, never in the cron path.
        </p>
        <button
          type="button"
          disabled={!aiGenerationAvailable}
          aria-disabled={!aiGenerationAvailable}
          className="mt-3 rounded-full border border-[#3B2F2F]/14 bg-white px-3.5 py-1.5 text-xs font-medium text-[#3B2F2F]/45 hover:bg-white"
          title={aiGenerationDisabledReason ?? "AI-assisted improvement"}
        >
          {aiGenerationAvailable ? "Generate improved draft (manual review)" : "Generate improved draft (disabled)"}
        </button>
        {aiGenerationDisabledReason ? (
          <p className="mt-2 text-[11px] text-[#3B2F2F]/55">{aiGenerationDisabledReason}</p>
        ) : null}
      </article>
    </section>
  );
}
