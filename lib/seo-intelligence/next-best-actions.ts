// Next-best-action engine.
//
// Synthesises the existing deterministic engines (content decay, metadata
// coverage, schema coverage, internal linking, link suggestions, content
// calendar, ContentOps queue, data-pipeline health) into a single
// prioritised list of concrete actions an operator can take TODAY.
//
// Every action carries:
//
//   - priority    — high | medium | low (derived from severity + signal strength)
//   - effort      — low | medium | high (rough operator estimate, deterministic per action kind)
//   - impact      — low | medium | high (deterministic per action kind)
//   - reason      — one sentence explaining WHY this action is recommended
//   - relatedHref — where the operator should click to act
//   - source      — which engine produced this action (audit / explainability)
//
// No fake data. Every action has a verifiable footprint in the underlying
// engine reports; the reviewer can always click through and see the
// finding for themselves.

import {
  type Ga4StatusHint,
  type DataPipelineHealth,
} from "@/lib/seo-intelligence/data-pipeline-health";
import type {
  Draft,
  DraftStatusCounts,
} from "@/lib/contentops/drafts-store";
import {
  computePublishSafetyScore,
  type PublishSafetyVerdict,
} from "@/lib/contentops/publish-score";
import { validateDraft } from "@/lib/contentops/draft-validation";
import type { SeoIntelligenceReport } from "@/lib/seo-intelligence";
import type { ContentCalendarReport } from "@/lib/seo-intelligence/content-calendar";

export type ActionPriority = "high" | "medium" | "low";
export type ActionEffort = "low" | "medium" | "high";
export type ActionImpact = "low" | "medium" | "high";

export type NextBestActionKind =
  | "improve_thin_post"
  | "fix_metadata"
  | "add_internal_link"
  | "add_missing_cluster_article"
  | "review_product_schema"
  | "wait_for_ga4"
  | "wait_for_gsc"
  | "exclude_admin_traffic"
  | "publish_approved_content"
  | "fix_data_pipeline";

export type NextBestAction = {
  kind: NextBestActionKind;
  title: string;
  priority: ActionPriority;
  effort: ActionEffort;
  impact: ActionImpact;
  reason: string;
  /** Slug / id / category — what the action targets. Free-form for display. */
  relatedLabel: string | null;
  /** Where to go to act on this. Always an internal admin route. */
  relatedHref: string;
  /** Which engine produced this row — useful for the audit trail. */
  source: string;
};

export type NextBestActionsReport = {
  generatedAt: string;
  actions: NextBestAction[];
  /** Total actions before truncation — useful for "showing top N of M" framing. */
  totalAvailable: number;
};

const DEFAULT_LIMIT = 12;

function priorityRank(p: ActionPriority): number {
  if (p === "high") return 0;
  if (p === "medium") return 1;
  return 2;
}

function impactRank(i: ActionImpact): number {
  if (i === "high") return 0;
  if (i === "medium") return 1;
  return 2;
}

function effortRank(e: ActionEffort): number {
  if (e === "low") return 0;
  if (e === "medium") return 1;
  return 2;
}

/**
 * Sort:  high-priority first, then high-impact first, then low-effort first.
 * High-impact / low-effort wins ties — that's the classic ICE-style ordering
 * that surfaces "easy wins" above "big projects."
 */
function compareActions(a: NextBestAction, b: NextBestAction): number {
  const p = priorityRank(a.priority) - priorityRank(b.priority);
  if (p !== 0) return p;
  const i = impactRank(a.impact) - impactRank(b.impact);
  if (i !== 0) return i;
  return effortRank(a.effort) - effortRank(b.effort);
}

function ga4HintIsBlocking(hint: Ga4StatusHint): boolean {
  return hint === "auth_failed" || hint === "property_access_failed" || hint === "supabase_insert_failed";
}

function ga4HintIsWaitable(hint: Ga4StatusHint): boolean {
  return hint === "connected_reporting_delay" || hint === "no_snapshot_yet";
}

export type BuildNextBestActionsInput = {
  seo: SeoIntelligenceReport;
  pipeline: DataPipelineHealth;
  calendar: ContentCalendarReport;
  draftCounts: DraftStatusCounts | null;
  approvedDrafts: Draft[];
  limit?: number;
};

export function buildNextBestActions(input: BuildNextBestActionsInput): NextBestActionsReport {
  const { seo, pipeline, calendar, draftCounts, approvedDrafts, limit = DEFAULT_LIMIT } = input;
  const actions: NextBestAction[] = [];

  // ── Data pipeline health (a broken pipeline is the most blocking issue) ──
  if (ga4HintIsBlocking(pipeline.ga4.statusHint)) {
    actions.push({
      kind: "fix_data_pipeline",
      title: `Fix GA4 pipeline (${pipeline.ga4.statusHint.replace(/_/g, " ")})`,
      priority: "high",
      effort: "medium",
      impact: "high",
      reason:
        pipeline.ga4.statusDetail ||
        "GA4 data pipeline is failing — client-facing traffic reports cannot refresh until this is fixed.",
      relatedLabel: "GA4 connection",
      relatedHref: "/admin/readiness",
      source: "data-pipeline-health",
    });
  } else if (ga4HintIsWaitable(pipeline.ga4.statusHint)) {
    actions.push({
      kind: "wait_for_ga4",
      title: "Wait for GA4 reporting to catch up",
      priority: "low",
      effort: "low",
      impact: "low",
      reason:
        pipeline.ga4.statusDetail ||
        "GA4 is connected but the latest snapshot has 0 rows. Standard reports lag 24-48h on a new property.",
      relatedLabel: "GA4 connection",
      relatedHref: "/admin/readiness",
      source: "data-pipeline-health",
    });
  }

  if (pipeline.gsc.status !== "connected" && pipeline.gsc.envConfigured === false) {
    actions.push({
      kind: "wait_for_gsc",
      title: "Connect Search Console",
      priority: "medium",
      effort: "low",
      impact: "high",
      reason:
        "Search Console is not connected. Query-level data (which keywords pages already rank for) is unavailable until GSC env vars are set.",
      relatedLabel: "Search Console",
      relatedHref: "/admin/readiness",
      source: "data-pipeline-health",
    });
  }

  // Admin-traffic exclusion reminder — only show when the snapshot actually
  // contains admin traffic, otherwise the reminder is noise.
  if (
    seo.snapshotInsights.ga4.available &&
    seo.snapshotInsights.ga4.adminTotals.rowCount > 0
  ) {
    actions.push({
      kind: "exclude_admin_traffic",
      title: "Confirm admin-traffic exclusion in client reports",
      priority: "low",
      effort: "low",
      impact: "medium",
      reason: `Latest GA4 snapshot contains ${seo.snapshotInsights.ga4.adminTotals.rowCount} admin/internal page-path row(s) (${seo.snapshotInsights.ga4.adminTotals.sessions} sessions). The SEO dashboard already excludes them from client-facing tables — make sure exported reports do the same.`,
      relatedLabel: "GA4 admin filter",
      relatedHref: "/admin/seo",
      source: "snapshot-insights",
    });
  }

  // ── Approved drafts ready to publish ──
  const approvedReady: Array<{ slug: string; id: string; verdict: PublishSafetyVerdict }> = [];
  for (const draft of approvedDrafts) {
    const validation = validateDraft(draft);
    const score = computePublishSafetyScore(draft, { validation });
    approvedReady.push({ slug: draft.slug, id: draft.id, verdict: score.verdict });
  }
  for (const draft of approvedReady) {
    if (draft.verdict === "ready") {
      actions.push({
        kind: "publish_approved_content",
        title: `Publish "${draft.slug}"`,
        priority: "high",
        effort: "low",
        impact: "high",
        reason: "Draft is approved and the publish safety verdict is Ready. Run the manual prepare-publish flow when convenient.",
        relatedLabel: draft.slug,
        relatedHref: `/admin/contentops/${draft.id}/prepare-publish`,
        source: "publish-score",
      });
    }
  }

  // ── Thin / decaying content ──
  for (const report of seo.contentDecay.blogReports) {
    const critical = report.diagnostics.some((d) => d.severity === "critical");
    const warning = report.diagnostics.some((d) => d.severity === "warning");
    if (!critical && !warning) continue;
    actions.push({
      kind: "improve_thin_post",
      title: `Strengthen "${report.subject.title}"`,
      priority: critical ? "high" : "medium",
      effort: "medium",
      impact: critical ? "high" : "medium",
      reason:
        report.diagnostics
          .filter((d) => d.severity === "critical" || d.severity === "warning")
          .map((d) => d.message)
          .slice(0, 2)
          .join(" · ") || "Content decay engine flagged this post.",
      relatedLabel: report.subject.slug,
      relatedHref: `/blog/${report.subject.slug}`,
      source: "content-decay",
    });
  }

  // ── Metadata issues ──
  for (const report of seo.metadataCoverage.blogReports) {
    if (report.diagnostics.length === 0) continue;
    const critical = report.diagnostics.some((d) => d.severity === "critical");
    actions.push({
      kind: "fix_metadata",
      title: `Fix metadata on "${report.subject.title}"`,
      priority: critical ? "high" : "medium",
      effort: "low",
      impact: "medium",
      reason: report.diagnostics
        .map((d) => d.message)
        .slice(0, 2)
        .join(" · "),
      relatedLabel: report.subject.slug,
      relatedHref: `/blog/${report.subject.slug}`,
      source: "metadata-coverage",
    });
  }

  // ── Schema issues — products ──
  for (const report of seo.schemaCoverage.productReports) {
    if (report.diagnostics.length === 0) continue;
    const critical = report.diagnostics.some((d) => d.severity === "critical");
    actions.push({
      kind: "review_product_schema",
      title: `Review schema on "${report.subject.title}"`,
      priority: critical ? "high" : "low",
      effort: "low",
      impact: critical ? "medium" : "low",
      reason: report.diagnostics
        .map((d) => d.message)
        .slice(0, 2)
        .join(" · "),
      relatedLabel: report.subject.slug,
      relatedHref: `/shop/${report.subject.slug}`,
      source: "schema-coverage",
    });
  }

  // ── Internal link opportunities ──
  const totalLinkOps =
    seo.linkSuggestions.blogToBlog.length + seo.linkSuggestions.blogToProduct.length;
  if (totalLinkOps > 0) {
    actions.push({
      kind: "add_internal_link",
      title: `Apply ${totalLinkOps} internal-link suggestion(s)`,
      priority: totalLinkOps >= 5 ? "medium" : "low",
      effort: "low",
      impact: "medium",
      reason: `Deterministic Jaccard analysis surfaced ${seo.linkSuggestions.blogToBlog.length} blog↔blog and ${seo.linkSuggestions.blogToProduct.length} blog→product opportunities. Each suggestion ships with a copy-ready sentence.`,
      relatedLabel: "SEO Intelligence",
      relatedHref: "/admin/seo",
      source: "link-suggestions",
    });
  }

  // ── Content calendar (cluster gaps) ──
  if (calendar.stats.highPriority > 0) {
    actions.push({
      kind: "add_missing_cluster_article",
      title: `Plan ${calendar.stats.highPriority} high-priority cluster article(s)`,
      priority: "medium",
      effort: "high",
      impact: "high",
      reason: `Content calendar identified ${calendar.stats.highPriority} high-priority cluster gap(s). Filling them strengthens topical authority where the catalog already has products.`,
      relatedLabel: "Content calendar",
      relatedHref: "/admin/seo",
      source: "content-calendar",
    });
  }

  // ── Approved drafts that aren't Ready yet (Phase 1 surfaces this number) ──
  const notReadyApproved = approvedReady.filter((d) => d.verdict !== "ready");
  if (notReadyApproved.length > 0) {
    actions.push({
      kind: "improve_thin_post",
      title: `Review ${notReadyApproved.length} approved draft(s) flagged below Ready`,
      priority: "medium",
      effort: "medium",
      impact: "medium",
      reason:
        "These drafts are approved but the publish safety verdict is Needs Review or Do Not Publish Yet. Open them via the queue and use Improve before publishing.",
      relatedLabel: "ContentOps queue",
      relatedHref: "/admin/contentops?status=approved",
      source: "publish-score",
    });
  }

  // Dedupe by composite key — multiple engines may surface the same target.
  const deduped: NextBestAction[] = [];
  const seen = new Set<string>();
  for (const action of actions) {
    const key = `${action.kind}::${action.relatedHref}::${action.relatedLabel ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(action);
  }

  deduped.sort(compareActions);

  // Silence-the-empty-state: if nothing surfaced, emit a single "nothing to
  // do" row so the dashboard always renders a meaningful list.
  if (deduped.length === 0) {
    deduped.push({
      kind: "wait_for_ga4",
      title: "All major fronts look healthy — focus on cadence",
      priority: "low",
      effort: "low",
      impact: "low",
      reason:
        "No deterministic engine surfaced a blocker. Keep the cadence: publish approved drafts, monitor traffic, refresh decaying posts as GSC/GA4 data deepens.",
      relatedLabel: null,
      relatedHref: "/admin/seo",
      source: "fallback",
    });
  }

  // Touch unused queue counters here so the parameter does not look unused
  // when the engine grows new branches that read from it; right now the
  // value already flows through other surfaces of the report.
  void draftCounts;

  return {
    generatedAt: new Date().toISOString(),
    actions: deduped.slice(0, limit),
    totalAvailable: deduped.length,
  };
}
