import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminSectionNav } from "@/components/admin/admin-section-nav";
import { getAdminSessionFromPage } from "@/lib/admin-auth";
import { adminConfigHelpText, isAdminAuthConfigured } from "@/lib/admin-runtime";
import { listDraftSlugIndex, type DraftStatus } from "@/lib/contentops/drafts-store";
import {
  buildSeoIntelligenceReport,
  type Diagnostic,
  type Severity,
  type SubjectReport,
} from "@/lib/seo-intelligence";
import type { LinkSuggestion } from "@/lib/seo-intelligence/link-suggestions";
import type { PinterestSubjectReport } from "@/lib/seo-intelligence/pinterest-readiness";
import type { SeoHealthPillar } from "@/lib/seo-intelligence/seo-health";
import type { GscDeltaSet, Ga4DeltaSet, Delta } from "@/lib/seo-intelligence/snapshot-history";
import type { GscInsights, Ga4Insights, SnapshotFreshness } from "@/lib/seo-intelligence/snapshot-insights";

export const dynamic = "force-dynamic";

function severityClass(severity: Severity): string {
  if (severity === "critical") return "bg-[#F8E8EA] text-[#8A2F40]";
  if (severity === "warning") return "bg-[#FBEEDE] text-[#7A4A12]";
  if (severity === "info") return "bg-[#E7EEF7] text-[#1F3F66]";
  return "bg-[#E7F4EA] text-[#2E6A41]";
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-PK", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function DiagnosticItem({ d }: { d: Diagnostic }) {
  return (
    <li className="flex items-start gap-3 border-b border-[#3B2F2F]/8 py-2 last:border-b-0">
      <span
        className={[
          "mt-0.5 inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
          severityClass(d.severity),
        ].join(" ")}
      >
        {d.severity}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-[#1F1918]">{d.message}</p>
        <p className="mt-0.5 text-xs text-[#3B2F2F]/72">Why: {d.derivation}</p>
        {d.hint ? <p className="mt-0.5 text-xs text-[#3B2F2F]/65">Hint: {d.hint}</p> : null}
      </div>
    </li>
  );
}

function SubjectCardActions({
  report,
  draftIndex,
}: {
  report: SubjectReport;
  draftIndex: Map<string, { id: string; status: DraftStatus }>;
}) {
  if (report.subject.kind !== "blog") return null;
  const draft = draftIndex.get(report.subject.slug);
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {draft ? (
        <Link
          href={`/admin/contentops/${draft.id}`}
          className="inline-flex items-center gap-1 rounded-full border border-[#2F2624]/10 bg-white px-2.5 py-1 text-[11px] font-medium text-[#2F2624] hover:bg-[#F2EAE4]"
        >
          Open in ContentOps →
        </Link>
      ) : (
        <Link
          href={`/blog/${report.subject.slug}`}
          className="inline-flex items-center gap-1 rounded-full border border-[#3B2F2F]/12 bg-white px-2.5 py-1 text-[11px] text-[#3B2F2F]/72 hover:bg-[#F2EAE4]"
        >
          View live post →
        </Link>
      )}
    </div>
  );
}

function SubjectCard({
  report,
  draftIndex,
}: {
  report: SubjectReport;
  draftIndex?: Map<string, { id: string; status: DraftStatus }>;
}) {
  if (report.diagnostics.length === 0) {
    return (
      <article className="rounded-2xl border border-[#3B2F2F]/10 bg-[#FDF8F4] p-4">
        <p className="text-sm font-medium text-[#1F1918]">{report.subject.title}</p>
        <p className="mt-1 text-xs text-[#3B2F2F]/65">
          {report.subject.kind} · {report.subject.slug}
        </p>
        <p className="mt-2 inline-flex rounded-full bg-[#E7F4EA] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#2E6A41]">
          No diagnostics
        </p>
        {draftIndex ? <SubjectCardActions report={report} draftIndex={draftIndex} /> : null}
      </article>
    );
  }
  return (
    <article className="rounded-2xl border border-[#3B2F2F]/10 bg-[#FDF8F4] p-4">
      <p className="text-sm font-medium text-[#1F1918]">{report.subject.title}</p>
      <p className="mt-1 text-xs text-[#3B2F2F]/65">
        {report.subject.kind} · {report.subject.slug}
      </p>
      <ul className="mt-3">
        {report.diagnostics.map((d, idx) => (
          <DiagnosticItem key={idx} d={d} />
        ))}
      </ul>
      {draftIndex ? <SubjectCardActions report={report} draftIndex={draftIndex} /> : null}
    </article>
  );
}

function PinterestCard({ report }: { report: PinterestSubjectReport }) {
  const m = report.image;
  return (
    <article className="rounded-2xl border border-[#3B2F2F]/10 bg-[#FDF8F4] p-4">
      <p className="text-sm font-medium text-[#1F1918]">{report.subject.title}</p>
      <p className="mt-1 text-xs text-[#3B2F2F]/65">
        {report.subject.kind} · {report.subject.slug}
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-[#3B2F2F]/74">
        <dt>Image</dt>
        <dd className="truncate">{m.filePath}</dd>
        <dt>Dimensions</dt>
        <dd>{m.width && m.height ? `${m.width} × ${m.height}` : "—"}</dd>
        <dt>Ratio</dt>
        <dd>{m.ratio ? m.ratio.toFixed(2) : "—"}</dd>
        <dt>Verdict</dt>
        <dd>{m.verdict.replace(/_/g, " ")}</dd>
      </dl>
      {report.diagnostics.length > 0 ? (
        <ul className="mt-3">
          {report.diagnostics.map((d, idx) => (
            <DiagnosticItem key={idx} d={d} />
          ))}
        </ul>
      ) : (
        <p className="mt-3 inline-flex rounded-full bg-[#E7F4EA] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#2E6A41]">
          No diagnostics
        </p>
      )}
    </article>
  );
}

function summariseSeverity(diagnostics: Diagnostic[]): Severity {
  if (diagnostics.some((d) => d.severity === "critical")) return "critical";
  if (diagnostics.some((d) => d.severity === "warning")) return "warning";
  if (diagnostics.some((d) => d.severity === "info")) return "info";
  return "ok";
}

function FreshnessBadge({ f }: { f: SnapshotFreshness }) {
  const tone = f.isFresh ? "bg-[#E7F4EA] text-[#2E6A41]" : "bg-[#FBEEDE] text-[#7A4A12]";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ${tone}`}>
      Snapshot {f.snapshotDate} · {f.ageDays}d old
    </span>
  );
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString("en-PK");
}

function formatPosition(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "—";
  return value.toFixed(1);
}

function formatSeconds(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (value < 60) return `${value.toFixed(0)}s`;
  const minutes = Math.floor(value / 60);
  const seconds = Math.round(value - minutes * 60);
  return `${minutes}m ${seconds}s`;
}

function GscQueryTable({ rows, columns }: { rows: GscInsights["topByImpressions"]; columns: ("clicks" | "impressions" | "ctr" | "position")[] }) {
  if (rows.length === 0) {
    return <p className="mt-3 text-xs text-[#3B2F2F]/65">No rows in this slice.</p>;
  }
  return (
    <table className="mt-3 w-full table-auto text-xs">
      <thead>
        <tr className="text-left text-[#3B2F2F]/60">
          <th className="py-1 pr-3 font-medium">Query</th>
          <th className="py-1 pr-3 font-medium">Page</th>
          {columns.includes("clicks") ? <th className="py-1 pr-3 text-right font-medium">Clicks</th> : null}
          {columns.includes("impressions") ? <th className="py-1 pr-3 text-right font-medium">Impr.</th> : null}
          {columns.includes("ctr") ? <th className="py-1 pr-3 text-right font-medium">CTR</th> : null}
          {columns.includes("position") ? <th className="py-1 text-right font-medium">Pos.</th> : null}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, idx) => (
          <tr key={`${row.query}-${row.page}-${idx}`} className="border-t border-[#3B2F2F]/8">
            <td className="py-1.5 pr-3 text-[#1F1918]">{row.query}</td>
            <td className="py-1.5 pr-3 max-w-[280px] truncate text-[#3B2F2F]/72">{row.page}</td>
            {columns.includes("clicks") ? <td className="py-1.5 pr-3 text-right tabular-nums text-[#1F1918]">{formatNumber(row.clicks)}</td> : null}
            {columns.includes("impressions") ? <td className="py-1.5 pr-3 text-right tabular-nums text-[#1F1918]">{formatNumber(row.impressions)}</td> : null}
            {columns.includes("ctr") ? <td className="py-1.5 pr-3 text-right tabular-nums text-[#1F1918]">{formatPercent(row.ctr)}</td> : null}
            {columns.includes("position") ? <td className="py-1.5 text-right tabular-nums text-[#1F1918]">{formatPosition(row.position)}</td> : null}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Ga4PageTable({ rows, columns }: { rows: Ga4Insights["topBySessions"]; columns: ("sessions" | "users" | "engagement" | "bounce")[] }) {
  if (rows.length === 0) {
    return <p className="mt-3 text-xs text-[#3B2F2F]/65">No rows in this slice.</p>;
  }
  return (
    <table className="mt-3 w-full table-auto text-xs">
      <thead>
        <tr className="text-left text-[#3B2F2F]/60">
          <th className="py-1 pr-3 font-medium">Page</th>
          {columns.includes("sessions") ? <th className="py-1 pr-3 text-right font-medium">Sessions</th> : null}
          {columns.includes("users") ? <th className="py-1 pr-3 text-right font-medium">Users</th> : null}
          {columns.includes("engagement") ? <th className="py-1 pr-3 text-right font-medium">Avg sess.</th> : null}
          {columns.includes("bounce") ? <th className="py-1 text-right font-medium">Bounce</th> : null}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, idx) => (
          <tr key={`${row.pagePath}-${idx}`} className="border-t border-[#3B2F2F]/8">
            <td className="py-1.5 pr-3 max-w-[280px] truncate text-[#1F1918]">{row.pagePath}</td>
            {columns.includes("sessions") ? <td className="py-1.5 pr-3 text-right tabular-nums text-[#1F1918]">{formatNumber(row.sessions)}</td> : null}
            {columns.includes("users") ? <td className="py-1.5 pr-3 text-right tabular-nums text-[#1F1918]">{formatNumber(row.totalUsers)}</td> : null}
            {columns.includes("engagement") ? <td className="py-1.5 pr-3 text-right tabular-nums text-[#1F1918]">{formatSeconds(row.averageSessionDurationSeconds)}</td> : null}
            {columns.includes("bounce") ? <td className="py-1.5 text-right tabular-nums text-[#1F1918]">{formatPercent(row.bounceRate)}</td> : null}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function formatSignedNumber(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const formatted = Math.abs(value).toLocaleString("en-PK");
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `−${formatted}`;
  return formatted;
}

function formatSignedPercent(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const pct = value * 100;
  const sign = pct > 0 ? "+" : pct < 0 ? "−" : "";
  return `${sign}${Math.abs(pct).toFixed(1)}%`;
}

function deltaToneClass(absolute: number | null, positiveIsGood = true): string {
  if (absolute == null || absolute === 0) return "bg-[#E7EEF7] text-[#1F3F66]";
  const good = positiveIsGood ? absolute > 0 : absolute < 0;
  return good ? "bg-[#E7F4EA] text-[#2E6A41]" : "bg-[#FBEEDE] text-[#7A4A12]";
}

function TrendCard({
  label,
  current,
  delta,
  basisLabel,
  unit,
}: {
  label: string;
  current: number;
  delta: Delta;
  basisLabel: string;
  unit?: string;
}) {
  return (
    <article className="rounded-2xl border border-[#3B2F2F]/10 bg-[#FDF8F4] p-4">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#3B2F2F]/55">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-[#1F1918] tabular-nums">
        {Number.isFinite(current) ? current.toLocaleString("en-PK") : "—"}
        {unit ? <span className="ml-1 text-sm font-normal text-[#3B2F2F]/60">{unit}</span> : null}
      </p>
      <div className="mt-2 flex items-center gap-2">
        <span
          className={[
            "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
            deltaToneClass(delta.absolute),
          ].join(" ")}
        >
          {formatSignedNumber(delta.absolute)} ({formatSignedPercent(delta.percent)})
        </span>
        <span className="text-[10px] text-[#3B2F2F]/55">{basisLabel}</span>
      </div>
    </article>
  );
}

function GscDeltaGrid({ deltas }: { deltas: GscDeltaSet[] }) {
  if (deltas.length === 0) {
    return <p className="text-xs text-[#3B2F2F]/65">No history yet — first snapshot is the baseline.</p>;
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {deltas.map((d) => (
        <div key={d.basis} className="rounded-2xl border border-[#3B2F2F]/10 bg-white/90 p-4">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#3B2F2F]/55">
            vs {d.basis === "previous" ? "previous" : d.basis} {d.comparedAt ? `(${d.comparedAt})` : ""}
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <TrendCard label="Clicks" current={d.clicks.current} delta={d.clicks} basisLabel={`vs ${d.basis}`} />
            <TrendCard label="Impressions" current={d.impressions.current} delta={d.impressions} basisLabel={`vs ${d.basis}`} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Ga4DeltaGrid({ deltas }: { deltas: Ga4DeltaSet[] }) {
  if (deltas.length === 0) {
    return <p className="text-xs text-[#3B2F2F]/65">No history yet — first snapshot is the baseline.</p>;
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {deltas.map((d) => (
        <div key={d.basis} className="rounded-2xl border border-[#3B2F2F]/10 bg-white/90 p-4">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#3B2F2F]/55">
            vs {d.basis === "previous" ? "previous" : d.basis} {d.comparedAt ? `(${d.comparedAt})` : ""}
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <TrendCard label="Sessions" current={d.sessions.current} delta={d.sessions} basisLabel={`vs ${d.basis}`} />
            <TrendCard label="Users" current={d.totalUsers.current} delta={d.totalUsers} basisLabel={`vs ${d.basis}`} />
          </div>
        </div>
      ))}
    </div>
  );
}

function scoreClass(score: number): string {
  if (score >= 90) return "bg-[#E7F4EA] text-[#2E6A41]";
  if (score >= 75) return "bg-[#E7EEF7] text-[#1F3F66]";
  if (score >= 60) return "bg-[#FBEEDE] text-[#7A4A12]";
  return "bg-[#F8E8EA] text-[#8A2F40]";
}

function HealthPillarCard({ pillar }: { pillar: SeoHealthPillar }) {
  return (
    <article className="rounded-2xl border border-[#3B2F2F]/10 bg-[#FDF8F4] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[#1F1918]">{pillar.name}</p>
          <p className="mt-0.5 text-xs text-[#3B2F2F]/60">Weight {(pillar.weight * 100).toFixed(0)}%</p>
        </div>
        <span
          className={[
            "inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums",
            scoreClass(pillar.score),
          ].join(" ")}
        >
          {pillar.score}
        </span>
      </div>
      <p className="mt-2 text-xs text-[#3B2F2F]/72">{pillar.derivation}</p>
      {pillar.topFindings.length > 0 ? (
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-[#3B2F2F]/72">
          {pillar.topFindings.map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function LinkSuggestionsList({ suggestions }: { suggestions: LinkSuggestion[] }) {
  if (suggestions.length === 0) {
    return <p className="mt-3 text-xs text-[#3B2F2F]/65">No suggestions above the confidence threshold.</p>;
  }
  return (
    <ul className="mt-3 space-y-2">
      {suggestions.map((s, idx) => (
        <li
          key={`${s.from.slug}-${s.to.slug}-${idx}`}
          className="rounded-2xl border border-[#3B2F2F]/10 bg-[#FDF8F4] p-3"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="text-sm text-[#1F1918]">
              <span className="font-medium">{s.from.title}</span>
              <span className="px-1.5 text-[#3B2F2F]/45">→</span>
              <span className="font-medium">{s.to.title}</span>
              <span className="ml-1 rounded-full bg-[#EEE4DB] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[#3B2F2F]/70">
                {s.to.kind}
              </span>
            </p>
            <span className="inline-flex rounded-full bg-white px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#3B2F2F]/70">
              Confidence {(s.confidence * 100).toFixed(0)}%
            </span>
          </div>
          <p className="mt-1 text-xs text-[#3B2F2F]/72">
            Suggested anchor: <span className="font-medium text-[#1F1918]">{s.anchorSuggestion}</span>
          </p>
          <p className="mt-0.5 text-xs text-[#3B2F2F]/65">{s.reason}</p>
          {s.sharedKeywords.length > 0 ? (
            <p className="mt-0.5 text-xs text-[#3B2F2F]/60">Shared: {s.sharedKeywords.join(", ")}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export default async function SeoIntelligencePage() {
  if (!isAdminAuthConfigured()) {
    return (
      <main className="min-h-screen bg-[#FDF8F4] px-5 py-10 sm:px-6 lg:px-8">
        <section className="mx-auto max-w-3xl rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-7 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-9">
          <h1 className="text-3xl font-semibold tracking-tight text-[#1F1918]">Admin Locked</h1>
          <p className="mt-3 text-sm leading-relaxed text-[#3B2F2F]/72">{adminConfigHelpText()}</p>
        </section>
      </main>
    );
  }

  const session = await getAdminSessionFromPage();
  if (!session) {
    redirect("/admin/login?next=%2Fadmin%2Fseo");
  }

  const [report, draftSlugIndex] = await Promise.all([
    buildSeoIntelligenceReport(),
    listDraftSlugIndex().catch(() => new Map<string, { id: string; status: DraftStatus }>()),
  ]);

  return (
    <main className="min-h-screen bg-[#FDF8F4] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <section className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-5 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#3B2F2F]/50">Private Admin</p>
              <p className="mt-1 text-xs text-[#3B2F2F]/65">Signed in as {session.actorLabel}</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#1F1918] sm:text-4xl">
                SEO Intelligence
              </h1>
              <p className="mt-1 text-xs text-[#3B2F2F]/65">
                Generated {formatDateTime(report.generatedAt)} — every signal derives from real repo data or local
                images. No external calls.
              </p>
            </div>
            <AdminSectionNav active="seo" />
          </div>
        </header>

        {/* Provider connection states */}
        <section className="rounded-3xl border border-[#3B2F2F]/10 bg-white/90 p-5 sm:p-6">
          <h2 className="text-base font-semibold text-[#1F1918]">External providers</h2>
          <p className="mt-1 text-xs text-[#3B2F2F]/65">
            Search Console + GA4 power the signals this layer cannot derive locally (traffic, queries, CTR).
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <article className="rounded-2xl border border-[#3B2F2F]/10 bg-[#FDF8F4] p-4">
              <p className="text-sm font-medium text-[#1F1918]">Search Console</p>
              {report.providers.searchConsole.connected ? (
                <>
                  <p className="mt-1 inline-flex rounded-full bg-[#E7F4EA] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#2E6A41]">
                    Connected
                  </p>
                  <p className="mt-2 text-xs text-[#3B2F2F]/72">Site: {report.providers.searchConsole.siteUrl}</p>
                </>
              ) : (
                <>
                  <p className="mt-1 inline-flex rounded-full bg-[#FBEEDE] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#7A4A12]">
                    Not connected
                  </p>
                  <p className="mt-2 text-xs text-[#3B2F2F]/72">{report.providers.searchConsole.reason}</p>
                  <p className="mt-1 text-xs text-[#3B2F2F]/60">
                    Missing: {report.providers.searchConsole.missingEnv.join(", ")}
                  </p>
                </>
              )}
            </article>
            <article className="rounded-2xl border border-[#3B2F2F]/10 bg-[#FDF8F4] p-4">
              <p className="text-sm font-medium text-[#1F1918]">GA4 Data API</p>
              {report.providers.ga4.connected ? (
                <>
                  <p className="mt-1 inline-flex rounded-full bg-[#E7F4EA] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#2E6A41]">
                    Connected
                  </p>
                  <p className="mt-2 text-xs text-[#3B2F2F]/72">Property: {report.providers.ga4.propertyId}</p>
                </>
              ) : (
                <>
                  <p className="mt-1 inline-flex rounded-full bg-[#FBEEDE] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#7A4A12]">
                    Not connected
                  </p>
                  <p className="mt-2 text-xs text-[#3B2F2F]/72">{report.providers.ga4.reason}</p>
                  <p className="mt-1 text-xs text-[#3B2F2F]/60">
                    Missing: {report.providers.ga4.missingEnv.join(", ")}
                  </p>
                </>
              )}
            </article>
          </div>
        </section>

        {/* SEO Health Score — composite, deterministic, derivation-explained */}
        <section className="rounded-3xl border border-[#3B2F2F]/10 bg-white/90 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-[#1F1918]">SEO health score</h2>
              <p className="mt-1 text-xs text-[#3B2F2F]/65">
                Composite of 5 pillars derived from real repo data. Every pillar shows its derivation — no opaque
                scoring.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`inline-flex rounded-full px-3 py-1.5 text-sm font-semibold tabular-nums ${scoreClass(report.health.overall)}`}>
                {report.health.overall} / 100
              </span>
              <span className="rounded-full bg-[#EEE4DB] px-2.5 py-1 text-xs font-medium text-[#2E2323]">
                Grade {report.health.grade}
              </span>
            </div>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {report.health.pillars.map((p) => (
              <HealthPillarCard key={p.name} pillar={p} />
            ))}
          </div>
        </section>

        {/* Snapshot trends — previous, 7d, 30d deltas */}
        <section className="rounded-3xl border border-[#3B2F2F]/10 bg-white/90 p-5 sm:p-6">
          <h2 className="text-base font-semibold text-[#1F1918]">Snapshot trends</h2>
          <p className="mt-1 text-xs text-[#3B2F2F]/65">
            Differences between the current snapshot and the closest historical snapshot on or before each basis date.
            Missing comparisons show &ldquo;—&rdquo; — never estimated.
          </p>

          <h3 className="mt-5 text-sm font-semibold text-[#1F1918]">Search Console — clicks &amp; impressions</h3>
          <div className="mt-3">
            {report.snapshotHistory.gsc.available ? (
              <GscDeltaGrid deltas={report.snapshotHistory.gsc.deltas} />
            ) : (
              <p className="text-xs text-[#3B2F2F]/65">
                No Search Console snapshot available — connect GSC and let the cron run.
              </p>
            )}
          </div>

          <h3 className="mt-5 text-sm font-semibold text-[#1F1918]">GA4 — sessions &amp; users</h3>
          <div className="mt-3">
            {report.snapshotHistory.ga4.available ? (
              <Ga4DeltaGrid deltas={report.snapshotHistory.ga4.deltas} />
            ) : (
              <p className="text-xs text-[#3B2F2F]/65">
                No GA4 snapshot available — connect GA4 Data API and let the cron run.
              </p>
            )}
          </div>
        </section>

        {/* Internal-link suggestions — Phase 4 */}
        <section className="rounded-3xl border border-[#3B2F2F]/10 bg-white/90 p-5 sm:p-6">
          <h2 className="text-base font-semibold text-[#1F1918]">Internal-link suggestions</h2>
          <p className="mt-1 text-xs text-[#3B2F2F]/65">
            Deterministic Jaccard overlap on blog keywords + same-category in-stock products. Suggestions exclude
            self-links and any link already wired in body copy.
          </p>

          <h3 className="mt-5 text-sm font-semibold text-[#1F1918]">Blog ↔ blog opportunities</h3>
          <LinkSuggestionsList suggestions={report.linkSuggestions.blogToBlog} />

          <h3 className="mt-5 text-sm font-semibold text-[#1F1918]">Blog → product opportunities</h3>
          <LinkSuggestionsList suggestions={report.linkSuggestions.blogToProduct} />

          {report.linkSuggestions.skipped.length > 0 ? (
            <>
              <h3 className="mt-5 text-sm font-semibold text-[#1F1918]">Skipped</h3>
              <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-[#3B2F2F]/65">
                {report.linkSuggestions.skipped.map((s) => (
                  <li key={s.slug}>
                    <span className="text-[#1F1918]">{s.slug}</span> — {s.reason}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>

        {/* Schema coverage — Phase 3 */}
        <section className="rounded-3xl border border-[#3B2F2F]/10 bg-white/90 p-5 sm:p-6">
          <h2 className="text-base font-semibold text-[#1F1918]">Schema.org coverage</h2>
          <p className="mt-1 text-xs text-[#3B2F2F]/65">
            Audits the data feeding lib/json-ld.ts. Sitewide schemas are emitted unconditionally:{" "}
            <span className="font-medium text-[#1F1918]">{report.schemaCoverage.sitewideSchemas.join(", ")}</span>.
          </p>

          <h3 className="mt-5 text-sm font-semibold text-[#1F1918]">Products (with diagnostics)</h3>
          <details className="mt-3 rounded-2xl border border-[#3B2F2F]/10 bg-[#FDF8F4] p-4">
            <summary className="cursor-pointer text-sm font-medium text-[#1F1918]">
              {report.schemaCoverage.productReports.filter((r) => r.diagnostics.length > 0).length} of{" "}
              {report.schemaCoverage.productReports.length} products flagged
            </summary>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              {report.schemaCoverage.productReports
                .filter((r) => r.diagnostics.length > 0)
                .map((r) => (
                  <SubjectCard key={r.subject.slug} report={r} />
                ))}
            </div>
          </details>

          <h3 className="mt-5 text-sm font-semibold text-[#1F1918]">Blog posts (with diagnostics)</h3>
          <details className="mt-3 rounded-2xl border border-[#3B2F2F]/10 bg-[#FDF8F4] p-4">
            <summary className="cursor-pointer text-sm font-medium text-[#1F1918]">
              {report.schemaCoverage.blogReports.filter((r) => r.diagnostics.length > 0).length} of{" "}
              {report.schemaCoverage.blogReports.length} blog posts flagged
            </summary>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              {report.schemaCoverage.blogReports
                .filter((r) => r.diagnostics.length > 0)
                .map((r) => (
                  <SubjectCard key={r.subject.slug} report={r} draftIndex={draftSlugIndex} />
                ))}
            </div>
          </details>
        </section>

        {/* Search Console insights — real snapshot data */}
        <section className="rounded-3xl border border-[#3B2F2F]/10 bg-white/90 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-[#1F1918]">Search Console insights</h2>
              <p className="mt-1 text-xs text-[#3B2F2F]/65">
                Derived from the latest snapshot in <code>seo_gsc_snapshots</code>. Cron schedule: 06:00 UTC daily.
              </p>
            </div>
            {report.snapshotInsights.gsc.available === false ? null : (
              <FreshnessBadge f={report.snapshotInsights.gsc.freshness} />
            )}
          </div>
          {report.snapshotInsights.gsc.available === false ? (
            <p className="mt-3 rounded-2xl border border-[#3B2F2F]/10 bg-[#FDF8F4] p-4 text-sm text-[#3B2F2F]/72">
              {report.snapshotInsights.gsc.reason}
            </p>
          ) : (
            <>
              <p className="mt-3 text-xs text-[#3B2F2F]/65">
                Window {report.snapshotInsights.gsc.snapshot.windowStart} → {report.snapshotInsights.gsc.snapshot.windowEnd} ·
                {" "}{formatNumber(report.snapshotInsights.gsc.totals.clicks)} clicks · {formatNumber(report.snapshotInsights.gsc.totals.impressions)} impressions ·
                {" "}{report.snapshotInsights.gsc.snapshot.rowCount} query/page rows
              </p>

              <h3 className="mt-5 text-sm font-semibold text-[#1F1918]">Top queries by impressions</h3>
              <p className="text-xs text-[#3B2F2F]/60">Sort: impressions desc, top {report.snapshotInsights.gsc.topByImpressions.length}.</p>
              <GscQueryTable rows={report.snapshotInsights.gsc.topByImpressions} columns={["clicks", "impressions", "ctr", "position"]} />

              <h3 className="mt-5 text-sm font-semibold text-[#1F1918]">Low CTR · high impressions</h3>
              <p className="text-xs text-[#3B2F2F]/60">Filter: impressions ≥ 50 AND CTR &lt; 2%. Sort: impressions desc.</p>
              <GscQueryTable rows={report.snapshotInsights.gsc.lowCtrHighImpressions} columns={["impressions", "ctr", "position"]} />

              <h3 className="mt-5 text-sm font-semibold text-[#1F1918]">Near page-one queries</h3>
              <p className="text-xs text-[#3B2F2F]/60">Filter: avg position &lt; 10.5. Sort: position asc.</p>
              <GscQueryTable rows={report.snapshotInsights.gsc.nearPageOne} columns={["impressions", "ctr", "position"]} />

              <h3 className="mt-5 text-sm font-semibold text-[#1F1918]">Top queries by clicks</h3>
              <p className="text-xs text-[#3B2F2F]/60">Sort: clicks desc, top {report.snapshotInsights.gsc.topByClicks.length}.</p>
              <GscQueryTable rows={report.snapshotInsights.gsc.topByClicks} columns={["clicks", "impressions", "ctr", "position"]} />
            </>
          )}
        </section>

        {/* GA4 insights — real snapshot data */}
        <section className="rounded-3xl border border-[#3B2F2F]/10 bg-white/90 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-[#1F1918]">GA4 insights</h2>
              <p className="mt-1 text-xs text-[#3B2F2F]/65">
                Derived from the latest snapshot in <code>seo_ga4_snapshots</code>. Cron schedule: 06:00 UTC daily.
              </p>
            </div>
            {report.snapshotInsights.ga4.available === false ? null : (
              <FreshnessBadge f={report.snapshotInsights.ga4.freshness} />
            )}
          </div>
          {report.snapshotInsights.ga4.available === false ? (
            <p className="mt-3 rounded-2xl border border-[#3B2F2F]/10 bg-[#FDF8F4] p-4 text-sm text-[#3B2F2F]/72">
              {report.snapshotInsights.ga4.reason}
            </p>
          ) : (
            <>
              <p className="mt-3 text-xs text-[#3B2F2F]/65">
                Window {report.snapshotInsights.ga4.snapshot.windowStart} → {report.snapshotInsights.ga4.snapshot.windowEnd} ·
                {" "}{formatNumber(report.snapshotInsights.ga4.totals.sessions)} sessions · {formatNumber(report.snapshotInsights.ga4.totals.totalUsers)} users ·
                {" "}{report.snapshotInsights.ga4.snapshot.rowCount} page-path rows
              </p>

              <h3 className="mt-5 text-sm font-semibold text-[#1F1918]">Top pages by sessions</h3>
              <Ga4PageTable rows={report.snapshotInsights.ga4.topBySessions} columns={["sessions", "users", "engagement", "bounce"]} />

              <h3 className="mt-5 text-sm font-semibold text-[#1F1918]">Top pages by engagement</h3>
              <p className="text-xs text-[#3B2F2F]/60">Filter: sessions ≥ 10. Sort: avg session duration desc.</p>
              <Ga4PageTable rows={report.snapshotInsights.ga4.topByEngagement} columns={["sessions", "engagement", "bounce"]} />

              <h3 className="mt-5 text-sm font-semibold text-[#1F1918]">High-bounce with meaningful traffic</h3>
              <p className="text-xs text-[#3B2F2F]/60">Filter: sessions ≥ 20 AND bounce ≥ 70%.</p>
              <Ga4PageTable rows={report.snapshotInsights.ga4.highBounceWithTraffic} columns={["sessions", "bounce", "engagement"]} />
            </>
          )}
        </section>

        {/* Internal linking */}
        <section className="rounded-3xl border border-[#3B2F2F]/10 bg-white/90 p-5 sm:p-6">
          <h2 className="text-base font-semibold text-[#1F1918]">Internal linking</h2>
          <p className="mt-1 text-xs text-[#3B2F2F]/65">
            Orphan / weak-link detection across the live blog + product graph.
          </p>

          {report.internalLinking.globalDiagnostics.length > 0 ? (
            <ul className="mt-3">
              {report.internalLinking.globalDiagnostics.map((d, idx) => (
                <DiagnosticItem key={idx} d={d} />
              ))}
            </ul>
          ) : null}

          <h3 className="mt-5 text-sm font-semibold text-[#1F1918]">Blog posts</h3>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {report.internalLinking.blogReports.map((r) => (
              <SubjectCard key={r.subject.slug} report={r} draftIndex={draftSlugIndex} />
            ))}
          </div>

          <h3 className="mt-5 text-sm font-semibold text-[#1F1918]">Cluster strength by category</h3>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {report.internalLinking.clusterStrength.map((c) => (
              <li
                key={c.category}
                className="flex items-start justify-between gap-3 rounded-2xl border border-[#3B2F2F]/10 bg-[#FDF8F4] p-3"
              >
                <div>
                  <p className="text-sm font-medium text-[#1F1918]">{c.category}</p>
                  <p className="text-xs text-[#3B2F2F]/65">
                    {c.productCount} product{c.productCount === 1 ? "" : "s"} · {c.blogPostCount} post
                    {c.blogPostCount === 1 ? "" : "s"}
                  </p>
                  <p className="mt-1 text-xs text-[#3B2F2F]/72">{c.notes}</p>
                </div>
                <span
                  className={[
                    "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                    c.level === "strong"
                      ? "bg-[#E7F4EA] text-[#2E6A41]"
                      : c.level === "balanced"
                        ? "bg-[#E7EEF7] text-[#1F3F66]"
                        : c.level === "weak"
                          ? "bg-[#FBEEDE] text-[#7A4A12]"
                          : "bg-[#F8E8EA] text-[#8A2F40]",
                  ].join(" ")}
                >
                  {c.level}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Topic grouping */}
        <section className="rounded-3xl border border-[#3B2F2F]/10 bg-white/90 p-5 sm:p-6">
          <h2 className="text-base font-semibold text-[#1F1918]">Topic grouping (keyword overlap)</h2>
          <p className="mt-1 text-xs text-[#3B2F2F]/65">
            Deterministic Jaccard similarity on the keywords[] field. No AI, no opaque scores.
          </p>
          {report.topicGrouping.groups.length === 0 ? (
            <ul className="mt-3">
              {report.topicGrouping.globalDiagnostics.map((d, idx) => (
                <DiagnosticItem key={idx} d={d} />
              ))}
            </ul>
          ) : (
            <ul className="mt-3 space-y-3">
              {report.topicGrouping.groups.map((g) => (
                <li key={g.id} className="rounded-2xl border border-[#3B2F2F]/10 bg-[#FDF8F4] p-4">
                  <p className="text-sm font-semibold text-[#1F1918]">{g.members.length} posts grouped</p>
                  <p className="mt-1 text-xs text-[#3B2F2F]/65">{g.derivation}</p>
                  <ul className="mt-2 list-disc pl-5 text-sm text-[#1F1918]">
                    {g.members.map((m) => (
                      <li key={m.slug}>{m.title}</li>
                    ))}
                  </ul>
                  {g.sharedKeywords.length > 0 ? (
                    <p className="mt-2 text-xs text-[#3B2F2F]/72">
                      Shared keywords: {g.sharedKeywords.join(", ")}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {report.topicGrouping.isolatedPosts.length > 0 ? (
            <>
              <h3 className="mt-5 text-sm font-semibold text-[#1F1918]">Isolated posts</h3>
              <ul className="mt-2 space-y-1 text-sm text-[#3B2F2F]/74">
                {report.topicGrouping.isolatedPosts.map((p) => (
                  <li key={p.slug}>
                    <span className="text-[#1F1918]">{p.title}</span>
                    <span className="ml-2 text-xs text-[#3B2F2F]/60">— {p.reason}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>

        {/* Content decay */}
        <section className="rounded-3xl border border-[#3B2F2F]/10 bg-white/90 p-5 sm:p-6">
          <h2 className="text-base font-semibold text-[#1F1918]">Content decay (local signals)</h2>
          <p className="mt-1 text-xs text-[#3B2F2F]/65">
            Age, word count, sections, anchor product, image freshness. Traffic-decay signals require the GSC + GA4
            connections above.
          </p>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {report.contentDecay.blogReports.map((r) => (
              <article key={r.subject.slug} className="rounded-2xl border border-[#3B2F2F]/10 bg-[#FDF8F4] p-4">
                <p className="text-sm font-medium text-[#1F1918]">{r.subject.title}</p>
                <p className="mt-1 text-xs text-[#3B2F2F]/65">
                  {r.ageInDays} days old · {r.wordCount} words · {r.sectionCount} sections ·{" "}
                  {r.hasAnchorProduct ? "has anchor" : "no anchor"}
                </p>
                <ul className="mt-3">
                  {r.diagnostics.map((d, idx) => (
                    <DiagnosticItem key={idx} d={d} />
                  ))}
                </ul>
              </article>
            ))}
          </div>
          <details className="mt-4 rounded-2xl border border-[#3B2F2F]/10 bg-[#FDF8F4] p-4">
            <summary className="cursor-pointer text-sm font-medium text-[#1F1918]">
              What this engine cannot see ({report.contentDecay.knownBlindSpots.length})
            </summary>
            <ul className="mt-2 list-disc pl-5 text-xs text-[#3B2F2F]/74">
              {report.contentDecay.knownBlindSpots.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </details>
        </section>

        {/* Pinterest readiness */}
        <section className="rounded-3xl border border-[#3B2F2F]/10 bg-white/90 p-5 sm:p-6">
          <h2 className="text-base font-semibold text-[#1F1918]">Pinterest readiness</h2>
          <p className="mt-1 text-xs text-[#3B2F2F]/65">
            Image dimensions read directly from /public via sharp. Pin verdict matches Pinterest&rsquo;s published ratio
            guidance (2:3 ideal).
          </p>
          {report.pinterest.globalDiagnostics.length > 0 ? (
            <ul className="mt-3">
              {report.pinterest.globalDiagnostics.map((d, idx) => (
                <DiagnosticItem key={idx} d={d} />
              ))}
            </ul>
          ) : null}

          <h3 className="mt-5 text-sm font-semibold text-[#1F1918]">Blog hero images</h3>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {report.pinterest.blogReports.map((r) => (
              <PinterestCard key={r.subject.slug} report={r} />
            ))}
          </div>

          <h3 className="mt-5 text-sm font-semibold text-[#1F1918]">Product images</h3>
          <details className="mt-3 rounded-2xl border border-[#3B2F2F]/10 bg-[#FDF8F4] p-4">
            <summary className="cursor-pointer text-sm font-medium text-[#1F1918]">
              {report.pinterest.productReports.length} product images analysed
            </summary>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              {report.pinterest.productReports.map((r) => (
                <PinterestCard key={r.subject.slug} report={r} />
              ))}
            </div>
          </details>
        </section>

        {/* Metadata coverage */}
        <section className="rounded-3xl border border-[#3B2F2F]/10 bg-white/90 p-5 sm:p-6">
          <h2 className="text-base font-semibold text-[#1F1918]">Metadata coverage</h2>
          <p className="mt-1 text-xs text-[#3B2F2F]/65">
            Length checks for title / description, plus the keywords[] field on each blog post.
          </p>
          {report.metadataCoverage.siteLevelDiagnostics.length > 0 ? (
            <ul className="mt-3">
              {report.metadataCoverage.siteLevelDiagnostics.map((d, idx) => (
                <DiagnosticItem key={idx} d={d} />
              ))}
            </ul>
          ) : null}

          <h3 className="mt-5 text-sm font-semibold text-[#1F1918]">Blog posts</h3>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {report.metadataCoverage.blogReports.map((r) => {
              const top = summariseSeverity(r.diagnostics);
              return (
                <article key={r.subject.slug} className="rounded-2xl border border-[#3B2F2F]/10 bg-[#FDF8F4] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-[#1F1918]">{r.subject.title}</p>
                      <p className="mt-1 text-xs text-[#3B2F2F]/65">{r.subject.slug}</p>
                    </div>
                    <span
                      className={[
                        "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                        severityClass(top),
                      ].join(" ")}
                    >
                      {top}
                    </span>
                  </div>
                  {r.diagnostics.length > 0 ? (
                    <ul className="mt-3">
                      {r.diagnostics.map((d, idx) => (
                        <DiagnosticItem key={idx} d={d} />
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-[#3B2F2F]/65">All metadata lengths within recommended ranges.</p>
                  )}
                  <SubjectCardActions report={r} draftIndex={draftSlugIndex} />
                </article>
              );
            })}
          </div>

          <h3 className="mt-5 text-sm font-semibold text-[#1F1918]">Products (with diagnostics)</h3>
          <details className="mt-3 rounded-2xl border border-[#3B2F2F]/10 bg-[#FDF8F4] p-4">
            <summary className="cursor-pointer text-sm font-medium text-[#1F1918]">
              {report.metadataCoverage.productReports.filter((r) => r.diagnostics.length > 0).length} of{" "}
              {report.metadataCoverage.productReports.length} products flagged
            </summary>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              {report.metadataCoverage.productReports
                .filter((r) => r.diagnostics.length > 0)
                .map((r) => (
                  <SubjectCard key={r.subject.slug} report={r} />
                ))}
            </div>
          </details>
        </section>
      </section>
    </main>
  );
}
