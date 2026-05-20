// Operator-facing readiness dashboard. Sits between the status banner
// and the Admin & dev disclosure on the publish article page. Each
// facet renders as a compact row with a level pill, a one-line summary,
// and (when issues exist) a small list of the specific checks that need
// attention.
//
// Purely presentational. Receives a fully-computed PublishingReadiness
// from the wiring layer; no engine logic lives here.

import type {
  FacetState,
  PublishingReadiness,
  ReadinessCheck,
  ReadinessLevel,
} from "@/lib/contentops/publish-types";

type ReadinessPanelProps = {
  readiness: PublishingReadiness;
};

const LEVEL_PILL: Record<ReadinessLevel, { className: string; label: string }> = {
  ready: {
    className: "bg-[#D7ECDD] text-[#1E5A37]",
    label: "Ready",
  },
  warnings: {
    className: "bg-[#FBF5EA] text-[#5E4A1C]",
    label: "Warnings",
  },
  blocked: {
    className: "bg-[#FBEEF1] text-[#5E1C29]",
    label: "Blocking",
  },
  not_applicable: {
    className: "bg-[#EFE7DE] text-[#3B2F2F]/72",
    label: "Pending",
  },
};

const OVERALL_HEADLINE: Record<ReadinessLevel, string> = {
  ready: "All facets cleared for publish.",
  warnings: "Ready to publish, with a few non-blocking notes.",
  blocked: "Resolve blocking items before publishing.",
  not_applicable: "Awaiting setup.",
};

function CheckLine({ check }: { check: ReadinessCheck }) {
  const symbol =
    check.state === "blocked"
      ? "✗"
      : check.state === "warnings"
        ? "!"
        : check.state === "not_applicable"
          ? "—"
          : "✓";
  const color =
    check.state === "blocked"
      ? "text-[#5E1C29]"
      : check.state === "warnings"
        ? "text-[#5E4A1C]"
        : check.state === "not_applicable"
          ? "text-[#3B2F2F]/55"
          : "text-[#1E5A37]";
  return (
    <li className={`flex items-start gap-2 ${color}`}>
      <span className="mt-[2px] font-mono text-[11px] leading-none">{symbol}</span>
      <span className="leading-snug">
        <span className="text-[#1F1918]">{check.label}</span>
        {check.hint ? (
          <span className="block text-[#3B2F2F]/55">{check.hint}</span>
        ) : null}
      </span>
    </li>
  );
}

function FacetCard({ facet }: { facet: FacetState }) {
  const pill = LEVEL_PILL[facet.level];
  const issues = facet.checks.filter(
    (c) => c.state === "warnings" || c.state === "blocked",
  );
  const dimmed = facet.level === "not_applicable";

  return (
    <li
      className={[
        "rounded-2xl border border-[#3B2F2F]/10 bg-white/85 p-4",
        dimmed ? "opacity-65" : "",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[#1F1918]">{facet.label}</p>
        <span
          className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] ${pill.className}`}
        >
          {pill.label}
        </span>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-[#3B2F2F]/72">
        {facet.summary}
      </p>
      {issues.length > 0 ? (
        <ul className="mt-3 space-y-1.5 text-xs">
          {issues.map((check) => (
            <CheckLine key={check.id} check={check} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function ReadinessPanel({ readiness }: ReadinessPanelProps) {
  const overall = LEVEL_PILL[readiness.overall];
  return (
    <section className="rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-7 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-9">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#3B2F2F]/55">
            Publishing readiness
          </p>
          <p className="mt-1 text-sm text-[#1F1918]">
            {OVERALL_HEADLINE[readiness.overall]}
          </p>
        </div>
        <span
          className={`inline-block rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] ${overall.className}`}
        >
          {overall.label}
        </span>
      </div>
      <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {readiness.facets.map((facet) => (
          <FacetCard key={facet.facet} facet={facet} />
        ))}
      </ul>
    </section>
  );
}
