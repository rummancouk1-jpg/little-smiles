// SERP intelligence card. Heuristic recommendations surfaced as a calm
// editorial checklist — never as numeric scores. Stays a quiet quiet
// card when there's nothing meaningful to say.

import type { SerpIntelligenceReport } from "@/lib/contentops/intelligence/serp-intelligence";

type Props = {
  report: SerpIntelligenceReport;
};

const KIND_TONE: Record<string, string> = {
  structure: "bg-[#EFE7DE] text-[#3B2F2F]/72",
  imagery: "bg-[#D7E4EE] text-[#1E3F5A]",
  schema: "bg-[#D7ECDD] text-[#1E5A37]",
  intent: "bg-[#FBF3DD] text-[#5C4314]",
  discovery: "bg-[#F1DDE6] text-[#67324A]",
  seasonal: "bg-[#E5EAD9] text-[#3F4F1A]",
};

const KIND_LABEL: Record<string, string> = {
  structure: "Structure",
  imagery: "Imagery",
  schema: "Schema",
  intent: "Intent",
  discovery: "Discovery",
  seasonal: "Seasonal",
};

export function SerpIntelligenceCard({ report }: Props) {
  return (
    <article className="rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-5 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#3B2F2F]/55">
            SERP intelligence
          </p>
          <p className="mt-1 text-sm text-[#3B2F2F]/72">
            Heuristic recommendations on what high-ranking pages on this kind of
            topic usually do.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-[0.12em]">
          <span className="rounded-full bg-[#FBF3DD] px-2 py-0.5 font-medium text-[#5C4314]">
            {report.detectedIntent} intent
          </span>
          <span className="rounded-full border border-[#3B2F2F]/14 bg-white px-2 py-0.5 font-medium text-[#3B2F2F]/72">
            {report.recommendedWords.min}–{report.recommendedWords.max} words
          </span>
        </div>
      </div>

      {report.recommendations.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {report.recommendations.map((rec, i) => (
            <li
              key={`${rec.kind}-${i}`}
              className="flex items-start gap-2 rounded-2xl border border-[#3B2F2F]/10 bg-[#FBF7F3] p-3"
            >
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] ${KIND_TONE[rec.kind] ?? KIND_TONE.structure}`}
              >
                {KIND_LABEL[rec.kind] ?? rec.kind}
              </span>
              <p className="text-sm leading-relaxed text-[#1F1918]">{rec.message}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-2xl border border-dashed border-[#3B2F2F]/14 bg-[#FBF7F3] p-3 text-xs text-[#3B2F2F]/65">
          No standout recommendations. The article structure already matches
          what tends to rank for this kind of query.
        </p>
      )}

      {report.schemaOpportunities.length > 0 ? (
        <p className="mt-4 text-[11px] text-[#3B2F2F]/55">
          JSON-LD types worth emitting: {report.schemaOpportunities.join(", ")}.
        </p>
      ) : null}
    </article>
  );
}
