// Public entry point for SEO intelligence. Composes the per-concern
// engines into one report the wiring layer (app/admin/seo) renders.

import { getGa4ConnectionState, type Ga4ConnectionState } from "@/lib/providers/ga4";
import {
  getSearchConsoleConnectionState,
  type GscConnectionState,
} from "@/lib/providers/search-console";

import { buildContentDecayReport, type ContentDecayReport } from "@/lib/seo-intelligence/content-decay";
import { buildInternalLinkingReport, type InternalLinkingReport } from "@/lib/seo-intelligence/internal-linking";
import {
  buildLinkSuggestionReport,
  type LinkSuggestionReport,
} from "@/lib/seo-intelligence/link-suggestions";
import { buildMetadataCoverageReport, type MetadataCoverageReport } from "@/lib/seo-intelligence/metadata-coverage";
import { buildPinterestReadinessReport, type PinterestReadinessReport } from "@/lib/seo-intelligence/pinterest-readiness";
import { buildSchemaCoverageReport, type SchemaCoverageReport } from "@/lib/seo-intelligence/schema-coverage";
import {
  buildSeoHealthReport,
  type SeoHealthReport,
} from "@/lib/seo-intelligence/seo-health";
import {
  buildSnapshotHistoryReport,
  type SnapshotHistoryReport,
} from "@/lib/seo-intelligence/snapshot-history";
import { buildSnapshotInsightsReport, type SnapshotInsightsReport } from "@/lib/seo-intelligence/snapshot-insights";
import { buildTopicGroupingReport, type TopicGroupingReport } from "@/lib/seo-intelligence/topic-grouping";

export type SeoIntelligenceReport = {
  generatedAt: string;
  snapshotInsights: SnapshotInsightsReport;
  snapshotHistory: SnapshotHistoryReport;
  internalLinking: InternalLinkingReport;
  linkSuggestions: LinkSuggestionReport;
  pinterest: PinterestReadinessReport;
  contentDecay: ContentDecayReport;
  topicGrouping: TopicGroupingReport;
  metadataCoverage: MetadataCoverageReport;
  schemaCoverage: SchemaCoverageReport;
  health: SeoHealthReport;
  providers: {
    searchConsole: GscConnectionState;
    ga4: Ga4ConnectionState;
  };
};

export async function buildSeoIntelligenceReport(): Promise<SeoIntelligenceReport> {
  // Run async engines in parallel; the synchronous ones execute inline.
  const [pinterest, contentDecay, snapshotInsights] = await Promise.all([
    buildPinterestReadinessReport(),
    buildContentDecayReport(),
    buildSnapshotInsightsReport(),
  ]);

  const internalLinking = buildInternalLinkingReport();
  const linkSuggestions = buildLinkSuggestionReport();
  const topicGrouping = buildTopicGroupingReport();
  const metadataCoverage = buildMetadataCoverageReport();
  const schemaCoverage = buildSchemaCoverageReport();

  // Snapshot history relies on the same StoredSnapshot rows snapshot-insights
  // already loaded — pass them through instead of re-querying Supabase.
  const currentGsc = snapshotInsights.gsc.available ? snapshotInsights.gsc.snapshot : null;
  const currentGa4 = snapshotInsights.ga4.available ? snapshotInsights.ga4.snapshot : null;
  const snapshotHistory = await buildSnapshotHistoryReport(currentGsc, currentGa4);

  const health = buildSeoHealthReport({
    metadata: metadataCoverage,
    internalLinking,
    schema: schemaCoverage,
    contentDecay,
    topicGrouping,
  });

  return {
    generatedAt: new Date().toISOString(),
    snapshotInsights,
    snapshotHistory,
    internalLinking,
    linkSuggestions,
    pinterest,
    contentDecay,
    topicGrouping,
    metadataCoverage,
    schemaCoverage,
    health,
    providers: {
      searchConsole: getSearchConsoleConnectionState(),
      ga4: getGa4ConnectionState(),
    },
  };
}

export type { Diagnostic, Severity, SubjectReport } from "@/lib/seo-intelligence/types";
