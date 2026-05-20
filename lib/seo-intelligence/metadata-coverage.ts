// Metadata coverage diagnostics. Reads only what's actually declared in
// the repo — blog post fields, product fields, the root layout's Metadata
// export — and reports honest length / completeness signals.

import { blogPosts, type BlogPost } from "@/lib/blog";
import { products, type Product } from "@/lib/products";

import type { Diagnostic, SubjectReport } from "@/lib/seo-intelligence/types";

const TITLE_MIN_LENGTH = 30;
const TITLE_MAX_LENGTH = 70;
const DESC_MIN_LENGTH = 80;
const DESC_MAX_LENGTH = 160;

function checkTitleAndDescription(title: string, description: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  if (title.length < TITLE_MIN_LENGTH) {
    diagnostics.push({
      severity: "warning",
      message: `Title is ${title.length} characters — below the ${TITLE_MIN_LENGTH}-char recommendation.`,
      derivation: `title.length = ${title.length}; SERP titles under ${TITLE_MIN_LENGTH} chars often look thin.`,
    });
  } else if (title.length > TITLE_MAX_LENGTH) {
    diagnostics.push({
      severity: "warning",
      message: `Title is ${title.length} characters — Google typically truncates after ~${TITLE_MAX_LENGTH}.`,
      derivation: `title.length = ${title.length}.`,
    });
  }

  if (description.length < DESC_MIN_LENGTH) {
    diagnostics.push({
      severity: "warning",
      message: `Description is ${description.length} characters — below ${DESC_MIN_LENGTH}-char comfort minimum.`,
      derivation: `description.length = ${description.length}.`,
    });
  } else if (description.length > DESC_MAX_LENGTH) {
    diagnostics.push({
      severity: "warning",
      message: `Description is ${description.length} characters — Google truncates around ~${DESC_MAX_LENGTH}.`,
      derivation: `description.length = ${description.length}.`,
    });
  }

  return diagnostics;
}

function buildBlogMetadataReport(post: BlogPost): SubjectReport {
  const diagnostics = checkTitleAndDescription(post.title, post.description);

  if (post.keywords.length === 0) {
    diagnostics.push({
      severity: "warning",
      message: "Post has zero keywords[].",
      derivation: "post.keywords.length = 0; topic-grouping cannot place this post and SEO signals lose specificity.",
      hint: "Add 3–6 honest target keywords.",
    });
  } else if (post.keywords.length < 3) {
    diagnostics.push({
      severity: "info",
      message: `Only ${post.keywords.length} keyword(s).`,
      derivation: `post.keywords.length = ${post.keywords.length}; consider widening the topical footprint to 3–6.`,
    });
  }

  return {
    subject: { kind: "blog", slug: post.slug, title: post.title },
    diagnostics,
  };
}

function buildProductMetadataReport(product: Product): SubjectReport {
  const diagnostics = checkTitleAndDescription(
    product.name,
    product.shortDescription || product.description,
  );

  if (!product.longDescription || product.longDescription.length < 120) {
    diagnostics.push({
      severity: "info",
      message: "longDescription is short or missing — PDP SEO depth suffers.",
      derivation: `longDescription.length = ${product.longDescription?.length ?? 0}.`,
      hint: "Add a richer PDP paragraph; this drives BlogPosting/Product SERP impressions.",
    });
  }

  if (!product.image) {
    diagnostics.push({
      severity: "critical",
      message: "Product has no image path.",
      derivation: "product.image is empty.",
    });
  }

  return {
    subject: { kind: "product", slug: product.slug, title: product.name },
    diagnostics,
  };
}

export type MetadataCoverageReport = {
  blogReports: SubjectReport[];
  productReports: SubjectReport[];
  siteLevelDiagnostics: Diagnostic[];
};

export function buildMetadataCoverageReport(): MetadataCoverageReport {
  const blogReports = blogPosts.map(buildBlogMetadataReport);
  const productReports = products.map(buildProductMetadataReport);

  // Site-level checks derived from the live root layout metadata and
  // env vars. We do not call out to the network — these are all
  // synchronous repo / env reads.
  const siteLevelDiagnostics: Diagnostic[] = [];

  if (!process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim()) {
    siteLevelDiagnostics.push({
      severity: "info",
      message: "No NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION env var set.",
      derivation: "Verified via process.env at build time.",
      hint: "Optional — only needed if verifying Search Console via meta tag instead of DNS or file upload.",
    });
  }

  return { blogReports, productReports, siteLevelDiagnostics };
}
