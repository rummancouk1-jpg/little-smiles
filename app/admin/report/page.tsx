import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminSectionNav } from "@/components/admin/admin-section-nav";
import { CopyTextButton } from "@/components/admin/copy-text-button";
import { logSystemAudit } from "@/lib/admin-audit";
import { getAdminSessionFromPage } from "@/lib/admin-auth";
import { adminConfigHelpText, isAdminAuthConfigured } from "@/lib/admin-runtime";
import { countDraftsByStatus, listDrafts } from "@/lib/contentops/drafts-store";
import { validateDraft } from "@/lib/contentops/draft-validation";
import { computePublishSafetyScore } from "@/lib/contentops/publish-score";
import { buildSeoIntelligenceReport } from "@/lib/seo-intelligence";
import { buildContentCalendarReport } from "@/lib/seo-intelligence/content-calendar";
import {
  buildDataConfidenceReport,
  type ConfidenceLabel,
} from "@/lib/seo-intelligence/data-confidence";
import { buildDataPipelineHealth } from "@/lib/seo-intelligence/data-pipeline-health";
import {
  KNOWN_BLIND_SPOTS,
  MODULES,
  type ModuleCatalogEntry,
} from "@/lib/seo-intelligence/modules-catalog";
import {
  buildNextBestActions,
  type ActionEffort,
  type ActionImpact,
  type ActionPriority,
  type NextBestAction,
} from "@/lib/seo-intelligence/next-best-actions";

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

function scoreTone(score: number): string {
  if (score >= 90) return "bg-[#E7F4EA] text-[#2E6A41]";
  if (score >= 75) return "bg-[#E7EEF7] text-[#1F3F66]";
  if (score >= 60) return "bg-[#FBEEDE] text-[#7A4A12]";
  return "bg-[#F8E8EA] text-[#8A2F40]";
}

function confidenceTone(label: ConfidenceLabel): string {
  if (label === "high" || label === "active") return "bg-[#E7F4EA] text-[#2E6A41]";
  if (label === "connected" || label === "manual") return "bg-[#E7EEF7] text-[#1F3F66]";
  if (label === "low_sample" || label === "pending") return "bg-[#FBEEDE] text-[#7A4A12]";
  return "bg-[#EEE4DB] text-[#2E2323]";
}

function priorityTone(priority: ActionPriority): string {
  if (priority === "high") return "bg-[#F8E8EA] text-[#8A2F40]";
  if (priority === "medium") return "bg-[#FBEEDE] text-[#7A4A12]";
  return "bg-[#E7EEF7] text-[#1F3F66]";
}

function effortImpactTone(value: ActionEffort | ActionImpact): string {
  if (value === "high") return "bg-[#E7F4EA] text-[#2E6A41]";
  if (value === "medium") return "bg-[#FBEEDE] text-[#7A4A12]";
  return "bg-[#EEE4DB] text-[#2E2323]";
}

function ga4StatusLine(hint: string): string {
  if (hint === "connected_with_data") return "Connected with data";
  if (hint === "connected_reporting_delay") return "Connected · reports lag 24-48h";
  if (hint === "no_snapshot_yet") return "Configured · awaiting first snapshot";
  if (hint === "auth_failed") return "Auth failed — check OAuth credentials";
  if (hint === "property_access_failed") return "Property access failed — check property id";
  if (hint === "supabase_insert_failed") return "Snapshot persist failed — check Supabase";
  return "Not configured";
}

function groupModules(modules: ModuleCatalogEntry[]): Record<ModuleCatalogEntry["group"], ModuleCatalogEntry[]> {
  return modules.reduce<Record<ModuleCatalogEntry["group"], ModuleCatalogEntry[]>>(
    (acc, m) => {
      if (!acc[m.group]) acc[m.group] = [];
      acc[m.group].push(m);
      return acc;
    },
    {
      Insights: [],
      ContentOps: [],
      Pipeline: [],
      Reporting: [],
    },
  );
}

export default async function ClientReportPage() {
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
    redirect("/admin/login?next=%2Fadmin%2Freport");
  }

  const [seo, pipeline, draftCounts, approvedDrafts, calendar] = await Promise.all([
    buildSeoIntelligenceReport(),
    buildDataPipelineHealth(),
    countDraftsByStatus().catch(() => null),
    listDrafts("approved").catch(() => []),
    Promise.resolve(buildContentCalendarReport()),
  ]);

  const confidence = buildDataConfidenceReport({
    pipeline,
    insights: seo.snapshotInsights,
  });

  const nextBestActions = buildNextBestActions({
    seo,
    pipeline,
    calendar,
    draftCounts,
    approvedDrafts,
    limit: 12,
  });

  const thinContentCount = seo.contentDecay.blogReports.filter((r) =>
    r.diagnostics.some((d) => d.severity === "warning" || d.severity === "critical"),
  ).length;
  const internalLinkOps =
    seo.linkSuggestions.blogToBlog.length + seo.linkSuggestions.blogToProduct.length;
  const schemaIssues =
    seo.schemaCoverage.blogReports.filter((r) => r.diagnostics.length > 0).length +
    seo.schemaCoverage.productReports.filter((r) => r.diagnostics.length > 0).length;
  const productSeoIssues = seo.metadataCoverage.productReports.filter(
    (r) => r.diagnostics.length > 0,
  ).length;

  const approvedNotReady = approvedDrafts.filter((d) => {
    const v = validateDraft(d);
    const s = computePublishSafetyScore(d, { validation: v });
    return s.verdict !== "ready";
  }).length;
  const approvedReadyToPublish = approvedDrafts.length - approvedNotReady;

  // ── Biggest issues digest ──
  const biggestIssues: { label: string; detail: string; severity: "critical" | "warning" }[] = [];
  for (const report of seo.contentDecay.blogReports) {
    for (const d of report.diagnostics) {
      if (d.severity !== "critical" && d.severity !== "warning") continue;
      biggestIssues.push({
        label: `${report.subject.title}`,
        detail: d.message,
        severity: d.severity,
      });
    }
  }
  for (const report of seo.metadataCoverage.blogReports) {
    for (const d of report.diagnostics) {
      if (d.severity !== "critical" && d.severity !== "warning") continue;
      biggestIssues.push({
        label: `${report.subject.title} (metadata)`,
        detail: d.message,
        severity: d.severity,
      });
    }
  }
  for (const report of seo.schemaCoverage.blogReports) {
    for (const d of report.diagnostics) {
      if (d.severity !== "critical" && d.severity !== "warning") continue;
      biggestIssues.push({
        label: `${report.subject.title} (schema)`,
        detail: d.message,
        severity: d.severity,
      });
    }
  }
  biggestIssues.sort((a, b) =>
    a.severity === b.severity ? 0 : a.severity === "critical" ? -1 : 1,
  );
  const topBiggestIssues = biggestIssues.slice(0, 10);

  // ── Executive summary copy ──
  const executiveSummaryLines: string[] = [];
  executiveSummaryLines.push(
    `Site health is ${seo.health.grade} (${seo.health.overall}/100) based on ${seo.health.pillars.length} pillars of deterministic site data.`,
  );
  if (approvedReadyToPublish > 0) {
    executiveSummaryLines.push(
      `${approvedReadyToPublish} approved draft(s) are passing every safety check and ready to publish manually.`,
    );
  }
  if (approvedNotReady > 0) {
    executiveSummaryLines.push(
      `${approvedNotReady} approved draft(s) need a final review pass before publishing.`,
    );
  }
  if (thinContentCount > 0) {
    executiveSummaryLines.push(
      `${thinContentCount} published post(s) flagged for refresh by the content-decay engine.`,
    );
  }
  if (internalLinkOps > 0) {
    executiveSummaryLines.push(
      `${internalLinkOps} internal-link opportunit${internalLinkOps === 1 ? "y" : "ies"} available to apply manually.`,
    );
  }
  if (calendar.stats.highPriority > 0) {
    executiveSummaryLines.push(
      `${calendar.stats.highPriority} high-priority article idea(s) waiting in the content calendar.`,
    );
  }

  await logSystemAudit({
    action: "client_report_viewed",
    actorLabel: session.actorLabel,
    metadata: {
      healthScore: seo.health.overall,
      ga4Status: pipeline.ga4.statusHint,
      approvedNotReady,
      approvedReadyToPublish,
      actionCount: nextBestActions.actions.length,
    },
  }).catch(() => {});

  const modulesByGroup = groupModules(MODULES);

  // ── Copy-friendly client update (professional, no fake claims) ──
  const copyFriendlyUpdate = [
    `Little Smiles — Organic SEO + ContentOps update`,
    `Snapshot generated ${formatDateTime(seo.generatedAt)}.`,
    ``,
    `Headline`,
    `--------`,
    `Site health: ${seo.health.overall}/100 (grade ${seo.health.grade}) across ${seo.health.pillars.length} deterministic pillars.`,
    approvedReadyToPublish > 0
      ? `${approvedReadyToPublish} approved draft(s) ready to publish manually.`
      : `No approved drafts are flagged "Ready" this snapshot.`,
    approvedNotReady > 0
      ? `${approvedNotReady} approved draft(s) need a final review pass.`
      : ``,
    ``,
    `Data confidence`,
    `---------------`,
    ...confidence.map((row) => `- ${row.source}: ${row.display}`),
    ``,
    `Pipeline`,
    `--------`,
    `- GA4: ${ga4StatusLine(pipeline.ga4.statusHint)}${pipeline.ga4.latestSnapshotAt ? ` · last snapshot ${formatDateTime(pipeline.ga4.latestSnapshotAt)}` : ""}`,
    `- Search Console: ${pipeline.gsc.status}${pipeline.gsc.latestSnapshotAt ? ` · last snapshot ${formatDateTime(pipeline.gsc.latestSnapshotAt)}` : ""}`,
    `- Supabase: ${pipeline.supabase.reachable ? "reachable" : "unreachable"}`,
    ``,
    `ContentOps queue`,
    `----------------`,
    `- Approved: ${draftCounts?.approved ?? "—"} (${approvedReadyToPublish} Ready, ${approvedNotReady} need review)`,
    `- Pending review: ${draftCounts?.pending_review ?? "—"}`,
    `- Published: ${draftCounts?.published ?? "—"}`,
    `- Rejected: ${draftCounts?.rejected ?? "—"}`,
    ``,
    `Issue counts (deterministic, no estimates)`,
    `------------------------------------------`,
    `- Thin / decaying blog posts: ${thinContentCount}`,
    `- Internal-link opportunities: ${internalLinkOps}`,
    `- Schema issues (blog+product): ${schemaIssues}`,
    `- Product SEO issues: ${productSeoIssues}`,
    ``,
    `Top recommended next actions (${Math.min(nextBestActions.actions.length, 5)} of ${nextBestActions.totalAvailable})`,
    `----------------------------`,
    ...nextBestActions.actions
      .slice(0, 5)
      .map(
        (a, i) =>
          `${i + 1}. [${a.priority.toUpperCase()}] ${a.title} — effort ${a.effort} · impact ${a.impact}. ${a.reason}`,
      ),
    ``,
    `Limitations (honest disclosure)`,
    `-------------------------------`,
    ...KNOWN_BLIND_SPOTS.map((s) => `- ${s}`),
    ``,
    `Nothing in this update is estimated or scraped. Every figure can be traced to the deterministic engine that produced it.`,
  ]
    .filter((line) => line !== "")
    .join("\n");

  return (
    <main className="min-h-screen bg-[#FDF8F4] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <section className="mx-auto max-w-5xl space-y-6">
        <header className="rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-5 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#3B2F2F]/50">Private Admin</p>
              <p className="mt-1 text-xs text-[#3B2F2F]/65">Signed in as {session.actorLabel}</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#1F1918] sm:text-4xl">
                Client report
              </h1>
              <p className="mt-1 text-xs text-[#3B2F2F]/65">
                Generated {formatDateTime(seo.generatedAt)}. Every figure derives from the live repo + Supabase
                snapshot — no estimates, no scraped third-party data.
              </p>
            </div>
            <AdminSectionNav active="report" />
          </div>
        </header>

        {/* 1. Executive summary */}
        <section className="rounded-3xl border border-[#3B2F2F]/10 bg-white/90 p-5 sm:p-6">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#3B2F2F]/55">
            1 · Executive summary
          </p>
          <p className="mt-2 text-sm text-[#1F1918]">
            One-paragraph view of where the site stands today. Each sentence is derived from a deterministic engine
            and can be drilled into below.
          </p>
          <ul className="mt-3 space-y-1.5 text-sm text-[#1F1918]">
            {executiveSummaryLines.map((line, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#3B2F2F]/55" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* 2. Data confidence */}
        <section className="rounded-3xl border border-[#3B2F2F]/10 bg-white/90 p-5 sm:p-6">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#3B2F2F]/55">
            2 · Data confidence
          </p>
          <p className="mt-2 text-sm text-[#1F1918]">
            How trustworthy each data source is right now. Local data is fully reproducible; external connections
            improve over time as snapshots stack up.
          </p>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {confidence.map((row) => (
              <li key={row.source} className="rounded-2xl border border-[#3B2F2F]/10 bg-[#FDF8F4] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-[#1F1918]">{row.source}</p>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${confidenceTone(row.label)}`}
                  >
                    {row.display}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#3B2F2F]/72">{row.detail}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* 3. Current SEO health */}
        <section className="rounded-3xl border border-[#3B2F2F]/10 bg-white/90 p-5 sm:p-6">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#3B2F2F]/55">
            3 · Current SEO health
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[#1F1918]">
              Composite of {seo.health.pillars.length} deterministic pillars. Each pillar is independently verifiable
              on the SEO Intelligence page.
            </p>
            <div className="flex items-center gap-2">
              <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold tabular-nums ${scoreTone(seo.health.overall)}`}>
                {seo.health.overall}/100
              </span>
              <span className="rounded-full bg-[#EEE4DB] px-2 py-0.5 text-xs font-medium text-[#2E2323]">
                Grade {seo.health.grade}
              </span>
            </div>
          </div>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {seo.health.pillars.map((p) => (
              <li key={p.name} className="rounded-2xl border border-[#3B2F2F]/10 bg-[#FDF8F4] p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-[#1F1918]">{p.name}</p>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${scoreTone(p.score)}`}>
                    {p.score}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#3B2F2F]/70">
                  Weight {(p.weight * 100).toFixed(0)}% · {p.derivation}
                </p>
              </li>
            ))}
          </ul>
        </section>

        {/* 4. ContentOps pipeline */}
        <section className="rounded-3xl border border-[#3B2F2F]/10 bg-white/90 p-5 sm:p-6">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#3B2F2F]/55">
            4 · ContentOps pipeline
          </p>
          <p className="mt-2 text-sm text-[#1F1918]">
            Where the draft pipeline stands. Approved drafts split into &ldquo;Ready&rdquo; (safety verdict green) and
            &ldquo;Needs review&rdquo; (warnings remain).
          </p>
          {draftCounts ? (
            <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-[#3B2F2F]/10 bg-[#FDF8F4] p-3">
                <dt className="text-[11px] uppercase tracking-wide text-[#3B2F2F]/55">Approved · Ready</dt>
                <dd className="mt-0.5 text-xl font-semibold text-[#1F1918] tabular-nums">{approvedReadyToPublish}</dd>
              </div>
              <div className="rounded-2xl border border-[#3B2F2F]/10 bg-[#FDF8F4] p-3">
                <dt className="text-[11px] uppercase tracking-wide text-[#3B2F2F]/55">Approved · Needs review</dt>
                <dd className="mt-0.5 text-xl font-semibold text-[#1F1918] tabular-nums">{approvedNotReady}</dd>
              </div>
              <div className="rounded-2xl border border-[#3B2F2F]/10 bg-[#FDF8F4] p-3">
                <dt className="text-[11px] uppercase tracking-wide text-[#3B2F2F]/55">Pending review</dt>
                <dd className="mt-0.5 text-xl font-semibold text-[#1F1918] tabular-nums">{draftCounts.pending_review}</dd>
              </div>
              <div className="rounded-2xl border border-[#3B2F2F]/10 bg-[#FDF8F4] p-3">
                <dt className="text-[11px] uppercase tracking-wide text-[#3B2F2F]/55">Published</dt>
                <dd className="mt-0.5 text-xl font-semibold text-[#1F1918] tabular-nums">{draftCounts.published}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-3 text-xs text-[#3B2F2F]/72">Queue counts unavailable — check Supabase reachability.</p>
          )}
        </section>

        {/* 5. Biggest issues */}
        <section className="rounded-3xl border border-[#3B2F2F]/10 bg-white/90 p-5 sm:p-6">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#3B2F2F]/55">
            5 · Biggest issues
          </p>
          <p className="mt-2 text-sm text-[#1F1918]">
            Critical and warning-level findings across content decay, metadata, and schema engines.
          </p>
          {topBiggestIssues.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-[#2E6A41]/20 bg-[#EAF5EE] p-3 text-sm text-[#1E5A37]">
              No critical or warning-level issues detected. The deterministic engines all returned clean.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {topBiggestIssues.map((issue, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-3 rounded-2xl border border-[#3B2F2F]/10 bg-[#FDF8F4] p-3"
                >
                  <span
                    className={`mt-0.5 inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                      issue.severity === "critical"
                        ? "bg-[#F8E8EA] text-[#8A2F40]"
                        : "bg-[#FBEEDE] text-[#7A4A12]"
                    }`}
                  >
                    {issue.severity}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#1F1918]">{issue.label}</p>
                    <p className="mt-0.5 text-xs text-[#3B2F2F]/72">{issue.detail}</p>
                  </div>
                </li>
              ))}
              {biggestIssues.length > topBiggestIssues.length ? (
                <li className="text-xs text-[#3B2F2F]/65">
                  Showing top {topBiggestIssues.length} of {biggestIssues.length} — open SEO Intelligence to see the
                  rest.
                </li>
              ) : null}
            </ul>
          )}
        </section>

        {/* 6. Top recommended actions */}
        <section className="rounded-3xl border border-[#3B2F2F]/10 bg-white/90 p-5 sm:p-6">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#3B2F2F]/55">
            6 · Top recommended actions
          </p>
          <p className="mt-2 text-sm text-[#1F1918]">
            Synthesised from every engine. Ordered high-priority first, then high-impact, then low-effort.
            Showing top {nextBestActions.actions.length} of {nextBestActions.totalAvailable}.
          </p>
          <ol className="mt-3 space-y-2">
            {nextBestActions.actions.map((action: NextBestAction, idx: number) => (
              <li
                key={`${action.kind}-${idx}`}
                className="rounded-2xl border border-[#3B2F2F]/10 bg-[#FDF8F4] p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm font-medium text-[#1F1918]">{action.title}</p>
                  <div className="flex flex-wrap gap-1">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${priorityTone(action.priority)}`}>
                      {action.priority}
                    </span>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${effortImpactTone(action.effort)}`}>
                      effort {action.effort}
                    </span>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${effortImpactTone(action.impact)}`}>
                      impact {action.impact}
                    </span>
                  </div>
                </div>
                <p className="mt-1 text-xs text-[#3B2F2F]/72">{action.reason}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[#3B2F2F]/65">
                  {action.relatedLabel ? (
                    <span className="rounded-full bg-white px-2 py-0.5 font-mono">{action.relatedLabel}</span>
                  ) : null}
                  <span>source: {action.source}</span>
                  <Link
                    href={action.relatedHref}
                    className="ml-auto rounded-full border border-[#3B2F2F]/14 bg-white px-2.5 py-1 font-medium text-[#2E2323] hover:bg-[#F2EAE4]"
                  >
                    Open →
                  </Link>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* 7. Available intelligence modules */}
        <section className="rounded-3xl border border-[#3B2F2F]/10 bg-white/90 p-5 sm:p-6">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#3B2F2F]/55">
            7 · Available intelligence modules
          </p>
          <p className="mt-2 text-sm text-[#1F1918]">
            What is wired up today. Every module ships behind a deterministic engine — no third-party APIs unless
            explicitly mentioned.
          </p>
          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            {(Object.keys(modulesByGroup) as Array<ModuleCatalogEntry["group"]>).map((group) => (
              <div key={group}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[#3B2F2F]/65">{group}</h3>
                <ul className="mt-2 space-y-1.5">
                  {modulesByGroup[group].map((m) => (
                    <li key={m.key} className="rounded-2xl border border-[#3B2F2F]/10 bg-[#FDF8F4] p-3">
                      <p className="text-sm font-medium text-[#1F1918]">{m.name}</p>
                      <p className="mt-0.5 text-xs text-[#3B2F2F]/72">{m.description}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* 8. What the system cannot see yet */}
        <section className="rounded-3xl border border-[#3B2F2F]/10 bg-white/90 p-5 sm:p-6">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#3B2F2F]/55">
            8 · What the system cannot see yet
          </p>
          <p className="mt-2 text-sm text-[#1F1918]">
            Honest disclosure of limitations so the client knows exactly what is in v1 — and what would need
            extra integrations to add.
          </p>
          <ul className="mt-3 space-y-1.5 text-sm text-[#1F1918]">
            {KNOWN_BLIND_SPOTS.map((s, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#3B2F2F]/55" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* 9. Copy-friendly client update */}
        <section className="rounded-3xl border border-[#3B2F2F]/10 bg-[#2F2624] p-5 text-[#F6F1EC] sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#F6F1EC]/70">
                9 · Copy-friendly client update
              </p>
              <p className="mt-1 text-xs text-[#F6F1EC]/72">
                Paste into an email, Slack, or client deck. Everything is verifiable from the sections above.
              </p>
            </div>
            <CopyTextButton
              text={copyFriendlyUpdate}
              label="Copy client update"
              auditAction="client_summary_copied"
              auditMetadata={{
                healthScore: seo.health.overall,
                approvedReadyToPublish,
                approvedNotReady,
              }}
              className="rounded-full border border-[#F6F1EC]/25 bg-white/10 px-3.5 py-1.5 text-xs font-medium text-[#F6F1EC] hover:bg-white/20"
            />
          </div>
          <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-[11px] leading-relaxed">{copyFriendlyUpdate}</pre>
        </section>
      </section>
    </main>
  );
}
