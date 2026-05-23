// Data-confidence labels — what the client report shows next to each data
// source so the reader knows how much weight to put on each number.
//
// We deliberately do NOT phrase these as marketing-style "Excellent /
// Good / Poor" — they describe the state of the connection and how
// trustworthy the latest sample is.

import type { DataPipelineHealth } from "@/lib/seo-intelligence/data-pipeline-health";
import type { SnapshotInsightsReport } from "@/lib/seo-intelligence/snapshot-insights";

export type ConfidenceLabel = "high" | "active" | "low_sample" | "connected" | "pending" | "disabled" | "manual";

export type DataConfidenceRow = {
  source: "Local SEO data" | "GA4 data" | "Search Console data" | "AI generation";
  label: ConfidenceLabel;
  display: string;
  detail: string;
};

function ga4Label(input: {
  pipeline: DataPipelineHealth;
  insights: SnapshotInsightsReport;
}): { label: ConfidenceLabel; display: string; detail: string } {
  const { pipeline, insights } = input;
  if (!pipeline.ga4.envConfigured) {
    return {
      label: "pending",
      display: "Not connected",
      detail: "GA4 env vars not set. Configure GA4_PROPERTY_ID plus OAuth or service account credentials.",
    };
  }
  const hint = pipeline.ga4.statusHint;
  if (hint === "auth_failed" || hint === "property_access_failed" || hint === "supabase_insert_failed") {
    return {
      label: "pending",
      display: "Connection issue",
      detail: pipeline.ga4.statusDetail,
    };
  }
  if (hint === "no_snapshot_yet" || hint === "connected_reporting_delay") {
    return {
      label: "low_sample",
      display: "Connected · low sample size",
      detail: pipeline.ga4.statusDetail,
    };
  }
  if (insights.ga4.available && insights.ga4.publicTotals.sessions > 0) {
    return {
      label: "active",
      display: "Connected · active",
      detail: `Latest snapshot: ${insights.ga4.publicTotals.sessions.toLocaleString("en-PK")} public sessions across ${insights.ga4.publicTotals.rowCount} page-path row(s).`,
    };
  }
  return {
    label: "connected",
    display: "Connected",
    detail: pipeline.ga4.statusDetail,
  };
}

function gscLabel(input: {
  pipeline: DataPipelineHealth;
  insights: SnapshotInsightsReport;
}): { label: ConfidenceLabel; display: string; detail: string } {
  const { pipeline, insights } = input;
  if (!pipeline.gsc.envConfigured && pipeline.gsc.status !== "pending") {
    return {
      label: "pending",
      display: "Not connected",
      detail: "Search Console env vars not set. Configure SEARCH_CONSOLE_* credentials plus the site URL.",
    };
  }
  if (pipeline.gsc.status === "pending") {
    return {
      label: "pending",
      display: "Pending",
      detail: "Previously connected but the latest snapshot is missing — re-run the cron or check credentials.",
    };
  }
  if (insights.gsc.available && insights.gsc.totals.impressions > 0) {
    return {
      label: "active",
      display: "Connected · active",
      detail: `Latest snapshot: ${insights.gsc.totals.impressions.toLocaleString("en-PK")} impressions across ${insights.gsc.snapshot.rowCount} query/page row(s).`,
    };
  }
  return {
    label: "connected",
    display: "Connected",
    detail: "Search Console env is set; snapshot data has not flowed in yet.",
  };
}

function aiLabel(input: {
  improveEnabled: boolean;
  imageGenEnabled: boolean;
}): { label: ConfidenceLabel; display: string; detail: string } {
  if (input.improveEnabled || input.imageGenEnabled) {
    return {
      label: "manual",
      display: "Manual only",
      detail: `Assisted improvement ${input.improveEnabled ? "enabled" : "disabled"} · image generation ${input.imageGenEnabled ? "enabled" : "disabled"}. Both stay manual per-draft actions — never automatic, never in the cron path.`,
    };
  }
  return {
    label: "disabled",
    display: "Disabled by default",
    detail:
      "AI-assisted improvement and image generation stay off unless ANTHROPIC_API_KEY plus the per-feature env flag (CONTENTOPS_IMPROVE_ENABLED=1 or CONTENTOPS_IMAGE_GEN_ENABLED=1) are explicitly set.",
  };
}

export function buildDataConfidenceReport(input: {
  pipeline: DataPipelineHealth;
  insights: SnapshotInsightsReport;
}): DataConfidenceRow[] {
  const rows: DataConfidenceRow[] = [];

  rows.push({
    source: "Local SEO data",
    label: "high",
    display: "High confidence",
    detail:
      "Schema, metadata, internal-link graph, content-decay, topic grouping, and Pinterest readiness are derived from the repo + Supabase. Every number is reproducible from a deterministic function — no external API, no estimation.",
  });

  const ga4 = ga4Label(input);
  rows.push({ source: "GA4 data", ...ga4 });

  const gsc = gscLabel(input);
  rows.push({ source: "Search Console data", ...gsc });

  const improveEnabled =
    Boolean(process.env.ANTHROPIC_API_KEY?.trim()) &&
    process.env.CONTENTOPS_IMPROVE_ENABLED === "1";
  const imageGenEnabled =
    Boolean(process.env.ANTHROPIC_API_KEY?.trim()) &&
    process.env.CONTENTOPS_IMAGE_GEN_ENABLED === "1";
  rows.push({ source: "AI generation", ...aiLabel({ improveEnabled, imageGenEnabled }) });

  return rows;
}
