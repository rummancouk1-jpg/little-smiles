// Schema.org JSON-LD coverage audit.
//
// We don't run a headless browser. Instead we inspect the source-of-truth
// data the JSON-LD helpers read from (lib/products.ts, lib/blog.ts) and
// report whether every field a *good* PDP / BlogPosting schema needs is
// populated. The audit is deterministic and explainable — each missing
// field surfaces with a `derivation` so the operator can fix the data.

import { blogPosts, type BlogPost } from "@/lib/blog";
import { products, type Product } from "@/lib/products";

import type { Diagnostic, SubjectReport } from "@/lib/seo-intelligence/types";

export type SchemaCoverageReport = {
  productReports: SubjectReport[];
  blogReports: SubjectReport[];
  /** Sitewide schema graph types that are always emitted via the root layout. */
  sitewideSchemas: string[];
};

function productSchemaDiagnostics(product: Product): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  // Required Product schema fields per Google's structured-data guidance.
  if (!product.image || product.image.length === 0) {
    diagnostics.push({
      severity: "critical",
      message: "Product schema missing image — rich-result eligibility lost.",
      derivation: "product.image is empty; Schema.org/Product requires `image` for SERP rich results.",
      hint: "Set a real image path in lib/products.ts.",
    });
  }

  const desc = product.longDescription || product.description;
  if (!desc || desc.length < 50) {
    diagnostics.push({
      severity: "warning",
      message: "Product description too short for schema `description`.",
      derivation: `(longDescription || description).length = ${desc?.length ?? 0}; Google's Product structured data prefers ≥ 50 chars.`,
      hint: "Expand longDescription with one paragraph of honest, specific copy.",
    });
  }

  if (!Number.isFinite(product.pricePkr) || product.pricePkr <= 0) {
    diagnostics.push({
      severity: "critical",
      message: "Product schema missing valid `offers.price`.",
      derivation: `pricePkr = ${product.pricePkr}; Schema.org/Offer requires a positive numeric price.`,
    });
  }

  // Availability is always derivable from availabilityStatus — info only.
  if (product.availabilityStatus === "out_of_stock") {
    diagnostics.push({
      severity: "info",
      message: "Schema emits OutOfStock availability.",
      derivation: "availabilityStatus = out_of_stock; offer.availability = https://schema.org/OutOfStock.",
      hint: "Restock to upgrade SERP signal to InStock or LimitedAvailability.",
    });
  }

  return diagnostics;
}

function blogSchemaDiagnostics(post: BlogPost): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  if (!post.title || post.title.length < 10) {
    diagnostics.push({
      severity: "critical",
      message: "BlogPosting schema headline is too short.",
      derivation: `post.title.length = ${post.title?.length ?? 0}; Google requires a meaningful headline.`,
    });
  }

  if (!post.description || post.description.length < 50) {
    diagnostics.push({
      severity: "warning",
      message: "BlogPosting schema description below 50 chars.",
      derivation: `post.description.length = ${post.description?.length ?? 0}.`,
    });
  }

  if (!post.publishedAt || !/^\d{4}-\d{2}-\d{2}$/.test(post.publishedAt)) {
    diagnostics.push({
      severity: "critical",
      message: "BlogPosting schema datePublished invalid.",
      derivation: `publishedAt = "${post.publishedAt ?? ""}"; must match YYYY-MM-DD.`,
    });
  }

  if (post.keywords.length === 0) {
    diagnostics.push({
      severity: "info",
      message: "BlogPosting schema emits empty keywords string.",
      derivation: "post.keywords.length = 0; keywords[] feeds the schema's keywords field.",
    });
  }

  return diagnostics;
}

export function buildSchemaCoverageReport(): SchemaCoverageReport {
  const productReports: SubjectReport[] = products.map((p) => ({
    subject: { kind: "product", slug: p.slug, title: p.name },
    diagnostics: productSchemaDiagnostics(p),
  }));

  const blogReports: SubjectReport[] = blogPosts.map((post) => ({
    subject: { kind: "blog", slug: post.slug, title: post.title },
    diagnostics: blogSchemaDiagnostics(post),
  }));

  return {
    productReports,
    blogReports,
    // These are emitted unconditionally by lib/json-ld.ts via the root layout.
    sitewideSchemas: ["Organization", "WebSite", "BreadcrumbList (PDP + Blog)"],
  };
}
