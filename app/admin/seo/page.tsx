import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminSectionNav } from "@/components/admin/admin-section-nav";
import {
  Collapse,
  MiniBar,
  ScoreDial,
  StatTile,
  TonePill,
  VerdictBanner,
  scoreTone,
  severityToneClass,
  toneClass,
  type Tone,
} from "@/components/admin/admin-ui";
import { CopyTextButton } from "@/components/admin/copy-text-button";
import { getAdminSessionFromPage } from "@/lib/admin-auth";
import { adminConfigHelpText, isAdminAuthConfigured } from "@/lib/admin-runtime";
import { listDraftSlugIndex, type DraftStatus } from "@/lib/contentops/drafts-store";
import {
  buildSeoIntelligenceReport,
  type Diagnostic,
  type Severity,
  type SubjectReport,
} from "@/lib/seo-intelligence";
import {
  buildContentCalendarReport,
  type ContentCalendarIdea,
} from "@/lib/seo-intelligence/content-calendar";
import type { LinkSuggestion } from "@/lib/seo-intelligence/link-suggestions";
import type { PinterestSubjectReport } from "@/lib/seo-intelligence/pinterest-readiness";
import type { SeoHealthPillar } from "@/lib/seo-intelligence/seo-health";
import type { GscDeltaSet, Ga4DeltaSet, Delta } from "@/lib/seo-intelligence/snapshot-history";
import type { GscInsights, Ga4Insights, SnapshotFreshness } from "@/lib/seo-intelligence/snapshot-insights";

export const dynamic = "force-dynamic";

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
    <li className="flex items-start gap-3 border-b border-ink-base/8 py-2 last:border-b-0">
      <span
        className={[
          "mt-0.5 inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
          severityToneClass(d.severity),
        ].join(" ")}
      >
        {d.severity}
      </span>
      <div className="min-w-0 break-words">
        <p className="text-sm font-medium text-ink-strong">{d.message}</p>
        <p className="mt-0.5 text-xs text-ink-base/72">Why: {d.derivation}</p>
        {d.hint ? <p className="mt-0.5 text-xs text-ink-base/65">Hint: {d.hint}</p> : null}
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
          className="inline-flex items-center gap-1 rounded-full border border-ink-walnut/12 bg-surface-raised px-2.5 py-1 text-[11px] font-medium text-ink-walnut hover:bg-surface-hover"
        >
          Open in ContentOps →
        </Link>
      ) : (
        <Link
          href={`/blog/${report.subject.slug}`}
          className="inline-flex items-center gap-1 rounded-full border border-ink-base/12 bg-surface-raised px-2.5 py-1 text-[11px] text-ink-base/72 hover:bg-surface-hover"
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
  return (
    <article className="rounded-2xl border border-ink-base/10 bg-surface-raised/55 p-4">
      <p className="text-sm font-medium text-ink-strong">{report.subject.title}</p>
      <p className="mt-1 text-xs text-ink-base/65">
        {report.subject.kind} · {report.subject.slug}
      </p>
      {report.diagnostics.length === 0 ? (
        <p className="mt-2 inline-flex rounded-full bg-tone-green-tint px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-tone-green-deep">
          No diagnostics
        </p>
      ) : (
        <ul className="mt-3">
          {report.diagnostics.map((d, idx) => (
            <DiagnosticItem key={idx} d={d} />
          ))}
        </ul>
      )}
      {draftIndex ? <SubjectCardActions report={report} draftIndex={draftIndex} /> : null}
    </article>
  );
}

function PinterestCard({ report }: { report: PinterestSubjectReport }) {
  const m = report.image;
  return (
    <article className="rounded-2xl border border-ink-base/10 bg-surface-raised/55 p-4">
      <p className="text-sm font-medium text-ink-strong">{report.subject.title}</p>
      <p className="mt-1 text-xs text-ink-base/65">
        {report.subject.kind} · {report.subject.slug}
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-ink-base/74">
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
        <p className="mt-3 inline-flex rounded-full bg-tone-green-tint px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-tone-green-deep">
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
  return (
    <TonePill tone={f.isFresh ? "positive" : "warning"}>
      Snapshot {f.snapshotDate} · {f.ageDays}d old
    </TonePill>
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

/** Wide analytics tables scroll inside their own container — never the page. */
function TableScroll({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto">{children}</div>;
}

function GscQueryTable({ rows, columns }: { rows: GscInsights["topByImpressions"]; columns: ("clicks" | "impressions" | "ctr" | "position")[] }) {
  if (rows.length === 0) {
    return <p className="mt-3 text-xs text-ink-base/65">No rows in this slice.</p>;
  }
  return (
    <TableScroll>
      <table className="mt-3 w-full table-auto text-xs">
        <thead>
          <tr className="text-left text-ink-base/60">
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
            <tr key={`${row.query}-${row.page}-${idx}`} className="border-t border-ink-base/8">
              <td className="py-1.5 pr-3 text-ink-strong">{row.query}</td>
              <td className="py-1.5 pr-3 max-w-[280px] truncate text-ink-base/72">{row.page}</td>
              {columns.includes("clicks") ? <td className="py-1.5 pr-3 text-right tabular-nums text-ink-strong">{formatNumber(row.clicks)}</td> : null}
              {columns.includes("impressions") ? <td className="py-1.5 pr-3 text-right tabular-nums text-ink-strong">{formatNumber(row.impressions)}</td> : null}
              {columns.includes("ctr") ? <td className="py-1.5 pr-3 text-right tabular-nums text-ink-strong">{formatPercent(row.ctr)}</td> : null}
              {columns.includes("position") ? <td className="py-1.5 text-right tabular-nums text-ink-strong">{formatPosition(row.position)}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </TableScroll>
  );
}

function Ga4PageTable({ rows, columns }: { rows: Ga4Insights["topBySessions"]; columns: ("sessions" | "users" | "engagement" | "bounce")[] }) {
  if (rows.length === 0) {
    return <p className="mt-3 text-xs text-ink-base/65">No rows in this slice.</p>;
  }
  return (
    <TableScroll>
      <table className="mt-3 w-full table-auto text-xs">
        <thead>
          <tr className="text-left text-ink-base/60">
            <th className="py-1 pr-3 font-medium">Page</th>
            {columns.includes("sessions") ? <th className="py-1 pr-3 text-right font-medium">Sessions</th> : null}
            {columns.includes("users") ? <th className="py-1 pr-3 text-right font-medium">Users</th> : null}
            {columns.includes("engagement") ? <th className="py-1 pr-3 text-right font-medium">Avg sess.</th> : null}
            {columns.includes("bounce") ? <th className="py-1 text-right font-medium">Bounce</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={`${row.pagePath}-${idx}`} className="border-t border-ink-base/8">
              <td className="py-1.5 pr-3 max-w-[280px] truncate text-ink-strong">{row.pagePath}</td>
              {columns.includes("sessions") ? <td className="py-1.5 pr-3 text-right tabular-nums text-ink-strong">{formatNumber(row.sessions)}</td> : null}
              {columns.includes("users") ? <td className="py-1.5 pr-3 text-right tabular-nums text-ink-strong">{formatNumber(row.totalUsers)}</td> : null}
              {columns.includes("engagement") ? <td className="py-1.5 pr-3 text-right tabular-nums text-ink-strong">{formatSeconds(row.averageSessionDurationSeconds)}</td> : null}
              {columns.includes("bounce") ? <td className="py-1.5 text-right tabular-nums text-ink-strong">{formatPercent(row.bounceRate)}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </TableScroll>
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

function deltaTone(absolute: number | null, positiveIsGood = true): Tone {
  if (absolute == null || absolute === 0) return "info";
  const good = positiveIsGood ? absolute > 0 : absolute < 0;
  return good ? "positive" : "warning";
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
    <article className="rounded-2xl border border-ink-base/10 bg-surface-raised/55 p-4">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-ink-base/55">{label}</p>
      <p className="mt-2 font-heading text-2xl font-semibold text-ink-strong tabular-nums">
        {Number.isFinite(current) ? current.toLocaleString("en-PK") : "—"}
        {unit ? <span className="ml-1 text-sm font-normal text-ink-base/60">{unit}</span> : null}
      </p>
      <div className="mt-2 flex items-center gap-2">
        <span
          className={[
            "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
            toneClass(deltaTone(delta.absolute)),
          ].join(" ")}
        >
          {formatSignedNumber(delta.absolute)} ({formatSignedPercent(delta.percent)})
        </span>
        <span className="text-[10px] text-ink-base/55">{basisLabel}</span>
      </div>
    </article>
  );
}

function GscDeltaGrid({ deltas }: { deltas: GscDeltaSet[] }) {
  if (deltas.length === 0) {
    return <p className="text-xs text-ink-base/65">No history yet — first snapshot is the baseline.</p>;
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {deltas.map((d) => (
        <div key={d.basis} className="rounded-2xl border border-ink-base/10 bg-surface-card/90 p-4">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-ink-base/55">
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
    return <p className="text-xs text-ink-base/65">No history yet — first snapshot is the baseline.</p>;
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {deltas.map((d) => (
        <div key={d.basis} className="rounded-2xl border border-ink-base/10 bg-surface-card/90 p-4">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-ink-base/55">
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

function HealthPillarCard({ pillar }: { pillar: SeoHealthPillar }) {
  return (
    <article className="rounded-2xl border border-ink-base/10 bg-surface-raised/55 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-ink-strong">{pillar.name}</p>
          <p className="mt-0.5 text-xs text-ink-base/60">Weight {(pillar.weight * 100).toFixed(0)}%</p>
        </div>
        <span
          className={[
            "inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums",
            toneClass(scoreTone(pillar.score)),
          ].join(" ")}
        >
          {pillar.score}
        </span>
      </div>
      <p className="mt-2 text-xs text-ink-base/72">{pillar.derivation}</p>
      {pillar.topFindings.length > 0 ? (
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-ink-base/72">
          {pillar.topFindings.map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function LinkSuggestionsList({
  suggestions,
  draftIndex,
}: {
  suggestions: LinkSuggestion[];
  draftIndex?: Map<string, { id: string; status: DraftStatus }>;
}) {
  if (suggestions.length === 0) {
    return <p className="mt-3 text-xs text-ink-base/65">No suggestions above the confidence threshold.</p>;
  }
  return (
    <ul className="mt-3 space-y-2">
      {suggestions.map((s, idx) => {
        const fromDraft = draftIndex?.get(s.from.slug);
        return (
          <li
            key={`${s.from.slug}-${s.to.slug}-${idx}`}
            className="rounded-2xl border border-ink-base/10 bg-surface-raised/55 p-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="text-sm text-ink-strong">
                <span className="font-medium">{s.from.title}</span>
                <span className="px-1.5 text-ink-base/45">→</span>
                <span className="font-medium">{s.to.title}</span>
                <span className="ml-1 rounded-full bg-surface-raised px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-ink-base/70">
                  {s.to.kind}
                </span>
              </p>
              <span className="inline-flex rounded-full bg-surface-card px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-base/70">
                Confidence {(s.confidence * 100).toFixed(0)}%
              </span>
            </div>
            <p className="mt-1 text-xs text-ink-base/72">
              Suggested anchor: <span className="font-medium text-ink-strong">{s.anchorSuggestion}</span>
            </p>
            {s.placementSectionHeading ? (
              <p className="mt-0.5 text-xs text-ink-base/72">
                Placement: after section <span className="font-medium text-ink-strong">&ldquo;{s.placementSectionHeading}&rdquo;</span>
              </p>
            ) : null}
            <p className="mt-1 rounded-xl bg-surface-card px-3 py-2 text-xs italic text-ink-base/82">
              &ldquo;{s.suggestedSentence}&rdquo;
            </p>
            <p className="mt-1 text-xs text-ink-base/65">{s.reason}</p>
            {s.sharedKeywords.length > 0 ? (
              <p className="mt-0.5 text-xs text-ink-base/60">Shared: {s.sharedKeywords.join(", ")}</p>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {fromDraft ? (
                <Link
                  href={`/admin/contentops/${fromDraft.id}`}
                  className="inline-flex items-center gap-1 rounded-full border border-ink-walnut/12 bg-surface-raised px-2.5 py-1 text-[11px] font-medium text-ink-walnut hover:bg-surface-hover"
                >
                  Open in ContentOps →
                </Link>
              ) : (
                <Link
                  href={`/blog/${s.from.slug}`}
                  className="inline-flex items-center gap-1 rounded-full border border-ink-base/12 bg-surface-raised px-2.5 py-1 text-[11px] text-ink-base/72 hover:bg-surface-hover"
                >
                  View live post →
                </Link>
              )}
              <CopyTextButton
                text={s.suggestedSentence}
                label="Copy sentence"
                auditAction="link_suggestion_copied"
                auditMetadata={{ variant: "sentence", from: s.from.slug, toKind: s.to.kind, to: s.to.slug }}
                className="inline-flex items-center gap-1 rounded-full border border-ink-base/12 bg-surface-raised px-2.5 py-1 text-[11px] font-medium text-ink-strong hover:bg-surface-hover"
              />
              <CopyTextButton
                text={s.instructionText}
                label="Copy instruction"
                auditAction="link_suggestion_copied"
                auditMetadata={{ variant: "instruction", from: s.from.slug, toKind: s.to.kind, to: s.to.slug }}
                className="inline-flex items-center gap-1 rounded-full border border-ink-base/12 bg-surface-raised px-2.5 py-1 text-[11px] font-medium text-ink-strong hover:bg-surface-hover"
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

const CLUSTER_TONE: Record<string, Tone> = {
  strong: "positive",
  balanced: "info",
  weak: "warning",
  empty: "critical",
};

export default async function SeoIntelligencePage() {
  if (!isAdminAuthConfigured()) {
    return (
      <main className="min-h-screen bg-surface-page px-5 py-10 sm:px-6 lg:px-8">
        <section className="mx-auto max-w-3xl rounded-3xl border border-ink-base/10 bg-surface-card/90 p-7 shadow-card-rest sm:p-9">
          <h1 className="font-heading text-3xl font-semibold text-ink-strong">Admin Locked</h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-base/72">{adminConfigHelpText()}</p>
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
  const calendar = buildContentCalendarReport();

  // ---- Lead-with-the-answer derivations (no data changed, just summarised) ----
  const rankedPillars = [...report.health.pillars].sort((a, b) => a.score - b.score);
  const topFindings = rankedPillars.flatMap((p) => p.topFindings).slice(0, 3);
  const overallTone = scoreTone(report.health.overall);
  const gscConnected = report.providers.searchConsole.connected;
  const ga4Connected = report.providers.ga4.connected;

  // Per-section counts for the collapsed headers (so signal reads unopened).
  const schemaProductFlagged = report.schemaCoverage.productReports.filter((r) => r.diagnostics.length > 0).length;
  const schemaBlogFlagged = report.schemaCoverage.blogReports.filter((r) => r.diagnostics.length > 0).length;
  const metaBlogFlagged = report.metadataCoverage.blogReports.filter((r) => r.diagnostics.length > 0).length;
  const metaProductFlagged = report.metadataCoverage.productReports.filter((r) => r.diagnostics.length > 0).length;
  const decayFlagged = report.contentDecay.blogReports.filter((r) => r.diagnostics.length > 0).length;
  const pinterestHeroesFlagged = report.pinterest.blogReports.filter((r) => r.diagnostics.length > 0).length;
  const linkSuggestionCount =
    report.linkSuggestions.blogToBlog.length + report.linkSuggestions.blogToProduct.length;
  const weakClusters = report.internalLinking.clusterStrength.filter((c) => c.level === "weak" || c.level === "empty").length;

  const flaggedTone = (n: number): Tone => (n === 0 ? "positive" : "warning");

  return (
    <main className="min-h-screen bg-surface-page px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <section className="mx-auto max-w-6xl space-y-5">
        <header className="rounded-3xl border border-ink-base/10 bg-surface-card/90 p-5 shadow-card-rest sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="eyebrow">Private Admin</p>
              <p className="mt-1 text-xs text-ink-base/65">Signed in as {session.actorLabel}</p>
              <h1 className="mt-2 font-heading text-3xl font-semibold text-ink-strong sm:text-4xl">
                SEO Intelligence
              </h1>
              <p className="mt-1 text-xs text-ink-base/65">
                Generated {formatDateTime(report.generatedAt)} — every signal here is computed from
                your own site (catalog, blog, images). No third-party scraping or made-up numbers.
              </p>
            </div>
            <AdminSectionNav active="seo" />
          </div>
        </header>

        {/* ---------- LEAD: verdict, score, top fixes, pillar strip ---------- */}
        <VerdictBanner
          tone={overallTone}
          eyebrow="SEO health"
          title={`${report.health.overall}/100 · Grade ${report.health.grade}`}
          summary="Composite of 5 pillars derived from real repo data — every pillar shows its derivation below. No opaque scoring."
          aside={<ScoreDial score={report.health.overall} grade={report.health.grade} />}
          actions={
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                <TonePill tone={gscConnected ? "positive" : "warning"}>
                  Search Console {gscConnected ? "connected" : "not connected"}
                </TonePill>
                <TonePill tone={ga4Connected ? "positive" : "warning"}>
                  GA4 {ga4Connected ? "connected" : "not connected"}
                </TonePill>
              </div>
              {topFindings.length > 0 ? (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-base/55">
                    Fix first
                  </p>
                  <ul className="mt-1.5 space-y-1">
                    {topFindings.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-ink-base/82">
                        <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent-marigold" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm font-medium text-tone-green-deep">
                  No pillar findings — every pillar is clean. Still your call to review.
                </p>
              )}
            </div>
          }
        />

        {/* Pillar strip — the whole health picture at a glance */}
        <div className="rounded-3xl border border-ink-base/10 bg-surface-card/90 p-5 shadow-card-rest sm:p-6">
          <p className="eyebrow">Pillars</p>
          <div className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {report.health.pillars.map((p) => (
              <MiniBar key={p.name} label={p.name} value={p.score} />
            ))}
          </div>
        </div>

        {/* ---------- DETAIL: everything on-demand ---------- */}

        <Collapse
          summary="Pillar derivations"
          count={`${report.health.pillars.length} pillars`}
          countTone="neutral"
        >
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {report.health.pillars.map((p) => (
              <HealthPillarCard key={p.name} pillar={p} />
            ))}
          </div>
        </Collapse>

        <Collapse
          summary="External providers"
          count={gscConnected && ga4Connected ? "both connected" : "action needed"}
          countTone={gscConnected && ga4Connected ? "positive" : "warning"}
        >
          <p className="text-xs text-ink-base/65">
            Search Console + GA4 power the signals this layer cannot derive locally (traffic, queries, CTR).
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <article className="rounded-2xl border border-ink-base/10 bg-surface-raised/55 p-4">
              <p className="text-sm font-medium text-ink-strong">Search Console</p>
              {report.providers.searchConsole.connected ? (
                <>
                  <TonePill tone="positive" className="mt-1">Connected</TonePill>
                  <p className="mt-2 text-xs text-ink-base/72">Site: {report.providers.searchConsole.siteUrl}</p>
                </>
              ) : (
                <>
                  <TonePill tone="warning" className="mt-1">Not connected</TonePill>
                  <p className="mt-2 text-xs text-ink-base/72">{report.providers.searchConsole.reason}</p>
                  <p className="mt-1 text-xs text-ink-base/60">
                    Missing: {report.providers.searchConsole.missingEnv.join(", ")}
                  </p>
                </>
              )}
            </article>
            <article className="rounded-2xl border border-ink-base/10 bg-surface-raised/55 p-4">
              <p className="text-sm font-medium text-ink-strong">GA4 Data API</p>
              {report.providers.ga4.connected ? (
                <>
                  <TonePill tone="positive" className="mt-1">Connected</TonePill>
                  <p className="mt-2 text-xs text-ink-base/72">
                    Property: {report.providers.ga4.propertyId} · auth: {report.providers.ga4.authMode}
                  </p>
                </>
              ) : (
                <>
                  <TonePill tone="warning" className="mt-1">Not connected</TonePill>
                  <p className="mt-2 text-xs text-ink-base/72">{report.providers.ga4.reason}</p>
                  <p className="mt-1 text-xs text-ink-base/60">
                    Missing: {report.providers.ga4.missingEnv.join(", ")}
                  </p>
                </>
              )}
            </article>
          </div>
        </Collapse>

        <Collapse summary="Snapshot trends" count={`GSC ${report.snapshotHistory.gsc.available ? "✓" : "—"} · GA4 ${report.snapshotHistory.ga4.available ? "✓" : "—"}`}>
          <p className="text-xs text-ink-base/65">
            Differences between the current snapshot and the closest historical snapshot on or before each basis date.
            Missing comparisons show &ldquo;—&rdquo; — never estimated.
          </p>
          <h3 className="mt-5 text-sm font-semibold text-ink-strong">Search Console — clicks &amp; impressions</h3>
          <div className="mt-3">
            {report.snapshotHistory.gsc.available ? (
              <GscDeltaGrid deltas={report.snapshotHistory.gsc.deltas} />
            ) : (
              <p className="text-xs text-ink-base/65">No Search Console snapshot available — connect GSC and let the cron run.</p>
            )}
          </div>
          <h3 className="mt-5 text-sm font-semibold text-ink-strong">GA4 — sessions &amp; users</h3>
          <div className="mt-3">
            {report.snapshotHistory.ga4.available ? (
              <Ga4DeltaGrid deltas={report.snapshotHistory.ga4.deltas} />
            ) : (
              <p className="text-xs text-ink-base/65">No GA4 snapshot available — connect GA4 Data API and let the cron run.</p>
            )}
          </div>
        </Collapse>

        <Collapse
          summary="Internal-link suggestions"
          count={`${linkSuggestionCount} suggested`}
          countTone={linkSuggestionCount > 0 ? "info" : "neutral"}
        >
          <p className="text-xs text-ink-base/65">
            Deterministic Jaccard overlap on blog keywords + same-category in-stock products. Suggestions exclude
            self-links and any link already wired in body copy.
          </p>
          <h3 className="mt-5 text-sm font-semibold text-ink-strong">Blog ↔ blog opportunities</h3>
          <LinkSuggestionsList suggestions={report.linkSuggestions.blogToBlog} draftIndex={draftSlugIndex} />
          <h3 className="mt-5 text-sm font-semibold text-ink-strong">Blog → product opportunities</h3>
          <LinkSuggestionsList suggestions={report.linkSuggestions.blogToProduct} draftIndex={draftSlugIndex} />
          {report.linkSuggestions.skipped.length > 0 ? (
            <>
              <h3 className="mt-5 text-sm font-semibold text-ink-strong">Skipped</h3>
              <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-ink-base/65">
                {report.linkSuggestions.skipped.map((s) => (
                  <li key={s.slug}>
                    <span className="text-ink-strong">{s.slug}</span> — {s.reason}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </Collapse>

        <Collapse
          summary="Schema.org coverage"
          count={`${schemaProductFlagged + schemaBlogFlagged} flagged`}
          countTone={flaggedTone(schemaProductFlagged + schemaBlogFlagged)}
        >
          <p className="text-xs text-ink-base/65">
            Audits the data feeding lib/json-ld.ts. Sitewide schemas are emitted unconditionally:{" "}
            <span className="font-medium text-ink-strong">{report.schemaCoverage.sitewideSchemas.join(", ")}</span>.
          </p>
          <h3 className="mt-5 text-sm font-semibold text-ink-strong">
            Products — {schemaProductFlagged} of {report.schemaCoverage.productReports.length} flagged
          </h3>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {report.schemaCoverage.productReports
              .filter((r) => r.diagnostics.length > 0)
              .map((r) => (
                <SubjectCard key={r.subject.slug} report={r} />
              ))}
          </div>
          <h3 className="mt-5 text-sm font-semibold text-ink-strong">
            Blog posts — {schemaBlogFlagged} of {report.schemaCoverage.blogReports.length} flagged
          </h3>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {report.schemaCoverage.blogReports
              .filter((r) => r.diagnostics.length > 0)
              .map((r) => (
                <SubjectCard key={r.subject.slug} report={r} draftIndex={draftSlugIndex} />
              ))}
          </div>
        </Collapse>

        <Collapse
          summary="Search Console insights"
          count={report.snapshotInsights.gsc.available === false ? "no snapshot" : `${formatNumber(report.snapshotInsights.gsc.totals.clicks)} clicks`}
          countTone={report.snapshotInsights.gsc.available === false ? "neutral" : "info"}
        >
          <p className="text-xs text-ink-base/65">
            Derived from the latest snapshot in <code>seo_gsc_snapshots</code>. Cron schedule: 06:00 UTC daily.
          </p>
          {report.snapshotInsights.gsc.available === false ? (
            <p className="mt-3 rounded-2xl border border-ink-base/10 bg-surface-raised/55 p-4 text-sm text-ink-base/72">
              {report.snapshotInsights.gsc.reason}
            </p>
          ) : (
            <>
              <div className="mt-3"><FreshnessBadge f={report.snapshotInsights.gsc.freshness} /></div>
              <p className="mt-3 text-xs text-ink-base/65">
                Window {report.snapshotInsights.gsc.snapshot.windowStart} → {report.snapshotInsights.gsc.snapshot.windowEnd} ·
                {" "}{formatNumber(report.snapshotInsights.gsc.totals.clicks)} clicks · {formatNumber(report.snapshotInsights.gsc.totals.impressions)} impressions ·
                {" "}{report.snapshotInsights.gsc.snapshot.rowCount} query/page rows
              </p>
              <h3 className="mt-5 text-sm font-semibold text-ink-strong">Top queries by impressions</h3>
              <p className="text-xs text-ink-base/60">Sort: impressions desc, top {report.snapshotInsights.gsc.topByImpressions.length}.</p>
              <GscQueryTable rows={report.snapshotInsights.gsc.topByImpressions} columns={["clicks", "impressions", "ctr", "position"]} />
              <h3 className="mt-5 text-sm font-semibold text-ink-strong">Low CTR · high impressions</h3>
              <p className="text-xs text-ink-base/60">Filter: impressions ≥ 50 AND CTR &lt; 2%. Sort: impressions desc.</p>
              <GscQueryTable rows={report.snapshotInsights.gsc.lowCtrHighImpressions} columns={["impressions", "ctr", "position"]} />
              <h3 className="mt-5 text-sm font-semibold text-ink-strong">Near page-one queries</h3>
              <p className="text-xs text-ink-base/60">Filter: avg position &lt; 10.5. Sort: position asc.</p>
              <GscQueryTable rows={report.snapshotInsights.gsc.nearPageOne} columns={["impressions", "ctr", "position"]} />
              <h3 className="mt-5 text-sm font-semibold text-ink-strong">Top queries by clicks</h3>
              <p className="text-xs text-ink-base/60">Sort: clicks desc, top {report.snapshotInsights.gsc.topByClicks.length}.</p>
              <GscQueryTable rows={report.snapshotInsights.gsc.topByClicks} columns={["clicks", "impressions", "ctr", "position"]} />
            </>
          )}
        </Collapse>

        <Collapse
          summary="GA4 insights"
          count={report.snapshotInsights.ga4.available === false ? "no snapshot" : `${formatNumber(report.snapshotInsights.ga4.publicTotals.sessions)} sessions`}
          countTone={report.snapshotInsights.ga4.available === false ? "neutral" : "info"}
        >
          <p className="text-xs text-ink-base/65">
            Derived from the latest snapshot in <code>seo_ga4_snapshots</code>. Cron schedule: 06:00 UTC daily.
          </p>
          {report.snapshotInsights.ga4.available === false ? (
            <p className="mt-3 rounded-2xl border border-ink-base/10 bg-surface-raised/55 p-4 text-sm text-ink-base/72">
              {report.snapshotInsights.ga4.reason}
            </p>
          ) : (
            <>
              <div className="mt-3"><FreshnessBadge f={report.snapshotInsights.ga4.freshness} /></div>
              <p className="mt-3 text-xs text-ink-base/65">
                Window {report.snapshotInsights.ga4.snapshot.windowStart} → {report.snapshotInsights.ga4.snapshot.windowEnd} ·
                {" "}{formatNumber(report.snapshotInsights.ga4.totals.sessions)} total sessions · {formatNumber(report.snapshotInsights.ga4.totals.totalUsers)} total users ·
                {" "}{report.snapshotInsights.ga4.snapshot.rowCount} page-path rows
              </p>
              <p className="mt-2 rounded-2xl border border-tone-blue/15 bg-tone-blue-tint px-3 py-2 text-xs text-tone-blue">
                {report.snapshotInsights.ga4.adminExclusionNote}
              </p>
              <dl className="mt-2 grid gap-2 text-xs text-ink-base/72 sm:grid-cols-3">
                <div className="rounded-2xl border border-ink-base/10 bg-surface-raised/55 p-3">
                  <dt className="text-[11px] uppercase tracking-wide text-ink-base/55">Public traffic</dt>
                  <dd className="mt-0.5 text-sm font-semibold text-ink-strong tabular-nums">
                    {formatNumber(report.snapshotInsights.ga4.publicTotals.sessions)} sessions ·{" "}
                    {formatNumber(report.snapshotInsights.ga4.publicTotals.totalUsers)} users
                  </dd>
                  <dd className="mt-0.5 text-[11px] text-ink-base/60">
                    {report.snapshotInsights.ga4.publicTotals.rowCount} page-path row(s)
                  </dd>
                </div>
                <div className="rounded-2xl border border-ink-base/10 bg-surface-raised/55 p-3">
                  <dt className="text-[11px] uppercase tracking-wide text-ink-base/55">Admin/internal traffic</dt>
                  <dd className="mt-0.5 text-sm font-semibold text-ink-strong tabular-nums">
                    {formatNumber(report.snapshotInsights.ga4.adminTotals.sessions)} sessions ·{" "}
                    {formatNumber(report.snapshotInsights.ga4.adminTotals.totalUsers)} users
                  </dd>
                  <dd className="mt-0.5 text-[11px] text-ink-base/60">
                    {report.snapshotInsights.ga4.adminTotals.rowCount} page-path row(s)
                  </dd>
                </div>
                <div className="rounded-2xl border border-ink-base/10 bg-surface-raised/55 p-3">
                  <dt className="text-[11px] uppercase tracking-wide text-ink-base/55">All rows (raw)</dt>
                  <dd className="mt-0.5 text-sm font-semibold text-ink-strong tabular-nums">
                    {formatNumber(report.snapshotInsights.ga4.totals.sessions)} sessions ·{" "}
                    {formatNumber(report.snapshotInsights.ga4.totals.totalUsers)} users
                  </dd>
                  <dd className="mt-0.5 text-[11px] text-ink-base/60">
                    {report.snapshotInsights.ga4.snapshot.rowCount} page-path row(s)
                  </dd>
                </div>
              </dl>
              <h3 className="mt-5 text-sm font-semibold text-ink-strong">Top pages by sessions (public)</h3>
              <Ga4PageTable rows={report.snapshotInsights.ga4.topBySessions} columns={["sessions", "users", "engagement", "bounce"]} />
              <h3 className="mt-5 text-sm font-semibold text-ink-strong">Top pages by engagement (public)</h3>
              <p className="text-xs text-ink-base/60">Filter: sessions ≥ 10 · admin paths excluded. Sort: avg session duration desc.</p>
              <Ga4PageTable rows={report.snapshotInsights.ga4.topByEngagement} columns={["sessions", "engagement", "bounce"]} />
              <h3 className="mt-5 text-sm font-semibold text-ink-strong">High-bounce with traffic (public)</h3>
              <p className="text-xs text-ink-base/60">Filter: sessions ≥ 20 AND bounce ≥ 70% · admin paths excluded.</p>
              <Ga4PageTable rows={report.snapshotInsights.ga4.highBounceWithTraffic} columns={["sessions", "bounce", "engagement"]} />
            </>
          )}
        </Collapse>

        <Collapse
          summary="Internal linking"
          count={weakClusters > 0 ? `${weakClusters} weak cluster${weakClusters === 1 ? "" : "s"}` : "clusters healthy"}
          countTone={weakClusters > 0 ? "warning" : "positive"}
        >
          <p className="text-xs text-ink-base/65">Orphan / weak-link detection across the live blog + product graph.</p>
          {report.internalLinking.globalDiagnostics.length > 0 ? (
            <ul className="mt-3">
              {report.internalLinking.globalDiagnostics.map((d, idx) => (
                <DiagnosticItem key={idx} d={d} />
              ))}
            </ul>
          ) : null}
          <h3 className="mt-5 text-sm font-semibold text-ink-strong">Blog posts</h3>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {report.internalLinking.blogReports.map((r) => (
              <SubjectCard key={r.subject.slug} report={r} draftIndex={draftSlugIndex} />
            ))}
          </div>
          <h3 className="mt-5 text-sm font-semibold text-ink-strong">Cluster strength by category</h3>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {report.internalLinking.clusterStrength.map((c) => (
              <li
                key={c.category}
                className="flex items-start justify-between gap-3 rounded-2xl border border-ink-base/10 bg-surface-raised/55 p-3"
              >
                <div>
                  <p className="text-sm font-medium text-ink-strong">{c.category}</p>
                  <p className="text-xs text-ink-base/65">
                    {c.productCount} product{c.productCount === 1 ? "" : "s"} · {c.blogPostCount} post
                    {c.blogPostCount === 1 ? "" : "s"}
                  </p>
                  <p className="mt-1 text-xs text-ink-base/72">{c.notes}</p>
                </div>
                <span
                  className={[
                    "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                    toneClass(CLUSTER_TONE[c.level] ?? "critical"),
                  ].join(" ")}
                >
                  {c.level}
                </span>
              </li>
            ))}
          </ul>
        </Collapse>

        <Collapse
          summary="Topic grouping (keyword overlap)"
          count={`${report.topicGrouping.groups.length} group${report.topicGrouping.groups.length === 1 ? "" : "s"}`}
          countTone="neutral"
        >
          <p className="text-xs text-ink-base/65">
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
                <li key={g.id} className="rounded-2xl border border-ink-base/10 bg-surface-raised/55 p-4">
                  <p className="text-sm font-semibold text-ink-strong">{g.members.length} posts grouped</p>
                  <p className="mt-1 text-xs text-ink-base/65">{g.derivation}</p>
                  <ul className="mt-2 list-disc pl-5 text-sm text-ink-strong">
                    {g.members.map((m) => (
                      <li key={m.slug}>{m.title}</li>
                    ))}
                  </ul>
                  {g.sharedKeywords.length > 0 ? (
                    <p className="mt-2 text-xs text-ink-base/72">Shared keywords: {g.sharedKeywords.join(", ")}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {report.topicGrouping.isolatedPosts.length > 0 ? (
            <>
              <h3 className="mt-5 text-sm font-semibold text-ink-strong">Isolated posts</h3>
              <ul className="mt-2 space-y-1 text-sm text-ink-base/74">
                {report.topicGrouping.isolatedPosts.map((p) => (
                  <li key={p.slug}>
                    <span className="text-ink-strong">{p.title}</span>
                    <span className="ml-2 text-xs text-ink-base/60">— {p.reason}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </Collapse>

        <Collapse
          summary="Content decay (local signals)"
          count={`${decayFlagged} flagged`}
          countTone={flaggedTone(decayFlagged)}
        >
          <p className="text-xs text-ink-base/65">
            Age, word count, sections, anchor product, image freshness. Traffic-decay signals require the GSC + GA4
            connections above.
          </p>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {report.contentDecay.blogReports.map((r) => (
              <article key={r.subject.slug} className="rounded-2xl border border-ink-base/10 bg-surface-raised/55 p-4">
                <p className="text-sm font-medium text-ink-strong">{r.subject.title}</p>
                <p className="mt-1 text-xs text-ink-base/65">
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
          <details className="mt-4 rounded-2xl border border-ink-base/10 bg-surface-raised/55 p-4">
            <summary className="cursor-pointer text-sm font-medium text-ink-strong">
              What this engine cannot see ({report.contentDecay.knownBlindSpots.length})
            </summary>
            <ul className="mt-2 list-disc pl-5 text-xs text-ink-base/74">
              {report.contentDecay.knownBlindSpots.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </details>
        </Collapse>

        <Collapse
          summary="Pinterest readiness"
          count={pinterestHeroesFlagged > 0 ? `${pinterestHeroesFlagged} hero${pinterestHeroesFlagged === 1 ? "" : "es"} need a taller crop` : "heroes ready"}
          countTone={flaggedTone(pinterestHeroesFlagged)}
        >
          <p className="text-xs text-ink-base/65">
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
          <h3 className="mt-5 text-sm font-semibold text-ink-strong">Blog hero images</h3>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {report.pinterest.blogReports.map((r) => (
              <PinterestCard key={r.subject.slug} report={r} />
            ))}
          </div>
          <details className="mt-5 rounded-2xl border border-ink-base/10 bg-surface-raised/55 p-4">
            <summary className="cursor-pointer text-sm font-medium text-ink-strong">
              Product images ({report.pinterest.productReports.length} analysed)
            </summary>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              {report.pinterest.productReports.map((r) => (
                <PinterestCard key={r.subject.slug} report={r} />
              ))}
            </div>
          </details>
        </Collapse>

        <Collapse
          summary="Metadata coverage"
          count={`${metaBlogFlagged + metaProductFlagged} flagged`}
          countTone={flaggedTone(metaBlogFlagged + metaProductFlagged)}
        >
          <p className="text-xs text-ink-base/65">
            Length checks for the resolved shipped title / description, plus the keywords[] field on each blog post.
          </p>
          {report.metadataCoverage.siteLevelDiagnostics.length > 0 ? (
            <ul className="mt-3">
              {report.metadataCoverage.siteLevelDiagnostics.map((d, idx) => (
                <DiagnosticItem key={idx} d={d} />
              ))}
            </ul>
          ) : null}
          <h3 className="mt-5 text-sm font-semibold text-ink-strong">Blog posts</h3>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {report.metadataCoverage.blogReports.map((r) => {
              const top = summariseSeverity(r.diagnostics);
              return (
                <article key={r.subject.slug} className="rounded-2xl border border-ink-base/10 bg-surface-raised/55 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-ink-strong">{r.subject.title}</p>
                      <p className="mt-1 text-xs text-ink-base/65">{r.subject.slug}</p>
                    </div>
                    <span
                      className={[
                        "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                        severityToneClass(top),
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
                    <p className="mt-2 text-xs text-ink-base/65">All metadata lengths within recommended ranges.</p>
                  )}
                  <SubjectCardActions report={r} draftIndex={draftSlugIndex} />
                </article>
              );
            })}
          </div>
          <h3 className="mt-5 text-sm font-semibold text-ink-strong">
            Products — {metaProductFlagged} of {report.metadataCoverage.productReports.length} flagged
          </h3>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {report.metadataCoverage.productReports
              .filter((r) => r.diagnostics.length > 0)
              .map((r) => (
                <SubjectCard key={r.subject.slug} report={r} />
              ))}
          </div>
        </Collapse>

        <Collapse
          summary="Content calendar"
          count={`${calendar.stats.totalIdeas} idea${calendar.stats.totalIdeas === 1 ? "" : "s"} · ${calendar.stats.highPriority} high`}
          countTone={calendar.stats.highPriority > 0 ? "warning" : "neutral"}
        >
          <p className="text-xs text-ink-base/65">{calendar.caveat}</p>
          <dl className="mt-3 grid gap-2 sm:grid-cols-4">
            <StatTile label="Cluster coverage" value={calendar.stats.byKind.cluster_coverage} />
            <StatTile label="Product support" value={calendar.stats.byKind.product_support} />
            <StatTile label="Internal linking" value={calendar.stats.byKind.internal_linking} />
            <StatTile label="Thin content expansion" value={calendar.stats.byKind.thin_content_expansion} />
          </dl>
          <ContentCalendarList ideas={calendar.ideas} />
        </Collapse>
      </section>
    </main>
  );
}

function ContentCalendarList({ ideas }: { ideas: ContentCalendarIdea[] }) {
  if (ideas.length === 0) {
    return <p className="mt-3 text-xs text-ink-base/65">No new ideas — every active category already has coverage.</p>;
  }
  return (
    <ul className="mt-3 grid gap-3 lg:grid-cols-2">
      {ideas.map((idea) => {
        const priorityTone: Tone =
          idea.priority === "high" ? "warning" : idea.priority === "medium" ? "info" : "neutral";
        return (
          <li key={idea.id} className="rounded-2xl border border-ink-base/10 bg-surface-raised/55 p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-ink-strong">{idea.suggestedTitle}</p>
              <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${toneClass(priorityTone)}`}>
                {idea.priority}
              </span>
            </div>
            <p className="mt-1 text-xs text-ink-base/65">
              {idea.targetCategory} · {idea.searchIntent.replace("_", " ")} ·{" "}
              <span className="rounded-full bg-surface-card px-1.5 py-0.5 text-[10px] font-medium text-ink-base/70">
                {idea.kindLabel}
              </span>
            </p>
            <p className="mt-2 text-xs font-medium text-ink-strong">{idea.whyItMatters}</p>
            <p className="mt-1 text-xs text-ink-base/72">{idea.reason}</p>

            <details className="mt-2 rounded-xl border border-ink-base/10 bg-surface-card p-2">
              <summary className="cursor-pointer text-[11px] font-medium text-ink-strong">
                Suggested outline ({idea.suggestedOutline.length} sections)
              </summary>
              <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-xs text-ink-base/82">
                {idea.suggestedOutline.map((h, hi) => (
                  <li key={hi}>{h}</li>
                ))}
              </ol>
            </details>

            <details className="mt-2 rounded-xl border border-ink-base/10 bg-surface-card p-2">
              <summary className="cursor-pointer text-[11px] font-medium text-ink-strong">
                Suggested FAQs ({idea.suggestedFaqs.length})
              </summary>
              <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-ink-base/82">
                {idea.suggestedFaqs.map((q, qi) => (
                  <li key={qi}>{q}</li>
                ))}
              </ul>
            </details>

            <p className="mt-2 text-[11px] uppercase tracking-wide text-ink-base/55">Suggested internal links</p>
            <ul className="mt-1 list-disc pl-5 text-xs text-ink-base/82">
              {idea.suggestedInternalLinks.map((href) => (
                <li key={href} className="font-mono">{href}</li>
              ))}
            </ul>

            {idea.suggestedProductCta ? (
              <p className="mt-2 text-xs text-ink-base/82">
                Suggested CTA product:{" "}
                <span className="font-medium text-ink-strong">{idea.suggestedProductCta.name}</span>
                <span className="ml-1 font-mono text-ink-base/65">/shop/{idea.suggestedProductCta.slug}</span>
              </p>
            ) : null}

            {idea.refreshTargetSlug ? (
              <p className="mt-2 text-[11px] text-ink-base/65">
                Refresh target: <span className="font-mono text-ink-strong">/blog/{idea.refreshTargetSlug}</span>
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
