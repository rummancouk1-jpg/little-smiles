// Public entry point for SEO intelligence. Composes the per-concern
// engines into one report the wiring layer (app/admin/seo) renders.

import { getGa4ConnectionState, type Ga4ConnectionState } from "@/lib/providers/ga4";
import {
  getSearchConsoleConnectionState,
  type GscConnectionState,
} from "@/lib/providers/search-console";

import { buildContentDecayReport, type ContentDecayReport } from "@/lib/seo-intelligence/content-decay";
import { buildInternalLinkingReport, type InternalLinkingReport } from "@/lib/seo-intelligence/internal-linking";
import { buildMetadataCoverageReport, type MetadataCoverageReport } from "@/lib/seo-intelligence/metadata-coverage";
import { buildPinterestReadinessReport, type PinterestReadinessReport } from "@/lib/seo-intelligence/pinterest-readiness";
import { buildSnapshotInsightsReport, type SnapshotInsightsReport } from "@/lib/seo-intelligence/snapshot-insights";
import { buildTopicGroupingReport, type TopicGroupingReport } from "@/lib/seo-intelligence/topic-grouping";

export type SeoIntelligenceReport = {
  generatedAt: string;
  snapshotInsights: SnapshotInsightsReport;
  internalLinking: InternalLinkingReport;
  pinterest: PinterestReadinessReport;
  contentDecay: ContentDecayReport;
  topicGrouping: TopicGroupingReport;
  metadataCoverage: MetadataCoverageReport;
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

  return {
    generatedAt: new Date().toISOString(),
    snapshotInsights,
    internalLinking: buildInternalLinkingReport(),
    pinterest,
    contentDecay,
    topicGrouping: buildTopicGroupingReport(),
    metadataCoverage: buildMetadataCoverageReport(),
    providers: {
      searchConsole: getSearchConsoleConnectionState(),
      ga4: getGa4ConnectionState(),
    },
  };
}

export type { Diagnostic, Severity, SubjectReport } from "@/lib/seo-intelligence/types";
