// Composite SEO health score.
//
// Every input is a real, derivable count from the existing engines —
// no fabricated weighting, no machine-learned "score." The formula is
// transparent: each pillar starts at 100 and loses points for explicit
// failures, with the derivation string showing exactly which subjects
// caused the deduction.
//
// IMPORTANT: this score is descriptive, not predictive. It tells you
// what state the site is in right now; it cannot estimate organic
// traffic gains.

import type { ContentDecayReport } from "@/lib/seo-intelligence/content-decay";
import type { InternalLinkingReport } from "@/lib/seo-intelligence/internal-linking";
import type { MetadataCoverageReport } from "@/lib/seo-intelligence/metadata-coverage";
import type { SchemaCoverageReport } from "@/lib/seo-intelligence/schema-coverage";
import type { TopicGroupingReport } from "@/lib/seo-intelligence/topic-grouping";
import type { Diagnostic, Severity, SubjectReport } from "@/lib/seo-intelligence/types";

const SEVERITY_WEIGHT: Record<Severity, number> = {
  critical: 8,
  warning: 3,
  info: 0, // info notes are observations, not health deductions
  ok: 0,
};

const PILLAR_MAX = 100;

function deductForReports(reports: SubjectReport[]): { deduction: number; sample: string[] } {
  let deduction = 0;
  const sample: string[] = [];
  for (const r of reports) {
    for (const d of r.diagnostics) {
      const w = SEVERITY_WEIGHT[d.severity] ?? 0;
      if (w > 0 && sample.length < 5) sample.push(`${r.subject.slug}: ${d.message}`);
      deduction += w;
    }
  }
  return { deduction, sample };
}

function deductForDiagnostics(diagnostics: Diagnostic[]): { deduction: number; sample: string[] } {
  let deduction = 0;
  const sample: string[] = [];
  for (const d of diagnostics) {
    const w = SEVERITY_WEIGHT[d.severity] ?? 0;
    if (w > 0 && sample.length < 5) sample.push(d.message);
    deduction += w;
  }
  return { deduction, sample };
}

function clampScore(raw: number): number {
  if (!Number.isFinite(raw)) return 0;
  if (raw < 0) return 0;
  if (raw > PILLAR_MAX) return PILLAR_MAX;
  return Math.round(raw);
}

export type SeoHealthPillar = {
  name: string;
  score: number;
  weight: number;
  derivation: string;
  topFindings: string[];
};

export type SeoHealthReport = {
  overall: number;
  grade: "A" | "B" | "C" | "D" | "F";
  pillars: SeoHealthPillar[];
  generatedAt: string;
};

function gradeFor(score: number): SeoHealthReport["grade"] {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

export type SeoHealthInput = {
  metadata: MetadataCoverageReport;
  internalLinking: InternalLinkingReport;
  schema: SchemaCoverageReport;
  contentDecay: ContentDecayReport;
  topicGrouping: TopicGroupingReport;
};

export function buildSeoHealthReport(input: SeoHealthInput): SeoHealthReport {
  // Metadata pillar — blog + product metadata length / keywords.
  const metaBlog = deductForReports(input.metadata.blogReports);
  const metaProduct = deductForReports(input.metadata.productReports);
  const metaSite = deductForDiagnostics(input.metadata.siteLevelDiagnostics);
  const metadataPillar: SeoHealthPillar = {
    name: "Metadata coverage",
    score: clampScore(PILLAR_MAX - metaBlog.deduction - metaProduct.deduction - metaSite.deduction),
    weight: 0.25,
    derivation: `100 − (blog ${metaBlog.deduction} + product ${metaProduct.deduction} + site ${metaSite.deduction}) point deductions.`,
    topFindings: [...metaBlog.sample, ...metaProduct.sample, ...metaSite.sample].slice(0, 5),
  };

  // Internal linking pillar.
  const linkBlog = deductForReports(input.internalLinking.blogReports);
  const linkProduct = deductForReports(input.internalLinking.productReports);
  const linkGlobal = deductForDiagnostics(input.internalLinking.globalDiagnostics);
  const internalLinkingPillar: SeoHealthPillar = {
    name: "Internal linking",
    score: clampScore(PILLAR_MAX - linkBlog.deduction - linkProduct.deduction - linkGlobal.deduction),
    weight: 0.2,
    derivation: `100 − (blog ${linkBlog.deduction} + product ${linkProduct.deduction} + global ${linkGlobal.deduction}) point deductions.`,
    topFindings: [...linkBlog.sample, ...linkProduct.sample, ...linkGlobal.sample].slice(0, 5),
  };

  // Schema pillar.
  const schemaProduct = deductForReports(input.schema.productReports);
  const schemaBlog = deductForReports(input.schema.blogReports);
  const schemaPillar: SeoHealthPillar = {
    name: "Schema coverage",
    score: clampScore(PILLAR_MAX - schemaProduct.deduction - schemaBlog.deduction),
    weight: 0.2,
    derivation: `100 − (product ${schemaProduct.deduction} + blog ${schemaBlog.deduction}) point deductions.`,
    topFindings: [...schemaProduct.sample, ...schemaBlog.sample].slice(0, 5),
  };

  // Content depth pillar — content-decay flags + topic isolation.
  const contentDeduction = deductForReports(input.contentDecay.blogReports);
  const isolationDeduction = input.topicGrouping.isolatedPosts.length * 2;
  const isolationSample = input.topicGrouping.isolatedPosts.slice(0, 3).map((p) => `Isolated: ${p.title}`);
  const contentPillar: SeoHealthPillar = {
    name: "Content depth & freshness",
    score: clampScore(PILLAR_MAX - contentDeduction.deduction - isolationDeduction),
    weight: 0.25,
    derivation: `100 − (decay ${contentDeduction.deduction} + ${input.topicGrouping.isolatedPosts.length} isolated posts × 2) deductions.`,
    topFindings: [...contentDeduction.sample, ...isolationSample].slice(0, 5),
  };

  // Catalog cluster health.
  const weakClusters = input.internalLinking.clusterStrength.filter((c) => c.level === "weak" || c.level === "empty");
  const clusterDeduction = weakClusters.length * 4;
  const clusterPillar: SeoHealthPillar = {
    name: "Topical cluster health",
    score: clampScore(PILLAR_MAX - clusterDeduction),
    weight: 0.1,
    derivation: `100 − (${weakClusters.length} weak/empty clusters × 4) deductions.`,
    topFindings: weakClusters.slice(0, 5).map((c) => `${c.category}: ${c.notes}`),
  };

  const pillars: SeoHealthPillar[] = [
    metadataPillar,
    internalLinkingPillar,
    schemaPillar,
    contentPillar,
    clusterPillar,
  ];

  const overall = clampScore(
    pillars.reduce((sum, p) => sum + p.score * p.weight, 0),
  );

  return {
    overall,
    grade: gradeFor(overall),
    pillars,
    generatedAt: new Date().toISOString(),
  };
}
