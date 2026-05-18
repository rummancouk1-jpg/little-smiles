// Shared types and the project-agnostic PublishAdapter contract.
// Engine code only — no project-specific imports. Concrete adapters live
// outside lib/contentops/ (e.g., lib/blog-publish-adapter.ts for Little
// Smiles) and never the other way around.

import { type BlogPost } from "@/lib/contentops/blog-schema";
import { type Draft } from "@/lib/contentops/drafts-store";

export type ConflictSeverity = "error" | "warning";

export type ConflictCode =
  | "SCHEMA_INVALID"
  | "SLUG_DUPLICATES_PUBLISHED"
  | "SLUG_DUPLICATES_OTHER_DRAFT"
  | "TITLE_DUPLICATES_PUBLISHED"
  | "CATEGORY_NO_PRODUCTS"
  | "CTA_HREF_MALFORMED"
  | "METADATA_TITLE_LENGTH"
  | "METADATA_DESCRIPTION_LENGTH";

export type Conflict = {
  code: ConflictCode;
  severity: ConflictSeverity;
  message: string;
  hint?: string;
};

export type ValidationReport = {
  schemaValid: boolean;
  schemaErrors: string[];
};

export type ExistingPostMetadata = {
  slug: string;
  title: string;
};

export type ImageAvailabilityReport = {
  ok: boolean;
  reason?: string;
};

export type PublishPreparation = {
  draft: Draft;
  validation: ValidationReport;
  conflicts: Conflict[];
  insertionPreview: BlogPost;
  diffText: string;
  ready: boolean;
  preparedAt: string;
};

/**
 * Contract every project adapter must satisfy for ContentOps publishing.
 *
 * The engine never imports a concrete adapter. The wiring layer (e.g.,
 * app/admin/contentops/...) imports both the engine and the project-
 * specific adapter implementation and composes them.
 */
export interface PublishAdapter {
  /** Returns metadata for posts already live in the project's publish target. */
  listExistingPostMetadata(): Promise<ExistingPostMetadata[]>;

  /** Builds the project-specific insertion object from a draft. */
  buildInsertionObject(draft: Draft): BlogPost;

  /** Builds the paste-ready diff text that the human will commit. */
  buildDiffText(insertion: BlogPost): string;

  /** Reports whether the insertion can render an image in the project's UI. */
  reportImageAvailability(insertion: BlogPost): ImageAvailabilityReport;
}
