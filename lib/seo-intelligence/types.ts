// Shared types for the SEO intelligence engines. Every diagnostic carries
// a `derivation` field so the surface can explain *why* a signal fired —
// no opaque scores, no fabricated metrics.

export type Severity = "ok" | "info" | "warning" | "critical";

export type Diagnostic = {
  severity: Severity;
  message: string;
  /** Plain-English explanation of how this diagnostic was derived. */
  derivation: string;
  hint?: string;
};

export type SubjectKind = "blog" | "product" | "category" | "site";

export type SubjectRef = {
  kind: SubjectKind;
  slug: string;
  title: string;
};

export type SubjectReport = {
  subject: SubjectRef;
  diagnostics: Diagnostic[];
};
