// Editorial fingerprint — the enforce-edit guard's pure core (Phase 3).
//
// The audit found the publish gate enforces human-APPROVED, not human-EDITED: a reviewer can one-click
// approve-then-publish an AI draft unchanged, and publishing goes straight live (no second deploy step). Phase 3
// raises AI-drafted volume, so this guard blocks publishing a draft that is byte-for-byte unchanged from its
// AI-generated original — the reviewer must actually touch it first.
//
// PURE + deterministic so it is unit-testable without Supabase. Compares only the EDITORIAL substance (title,
// description, sections, cta, faq, keywords, category) — NOT machine-managed fields (publishedAt, readTime,
// heroImage, provenance, slug) that the publish flow stamps automatically, so an auto-stamp can never be
// mistaken for a human edit and let an unedited draft through.

import type { BlogPost } from "@/lib/contentops/blog-schema";

/** Stable JSON of the fields a reviewer edits for substance. Key order is fixed so equal content → equal string. */
export function editorialFingerprint(content: BlogPost): string {
  return JSON.stringify({
    title: content.title,
    description: content.description,
    category: content.category,
    relatedProductCategory: content.relatedProductCategory,
    keywords: content.keywords,
    sections: content.sections,
    cta: content.cta,
    faq: content.faq ?? null,
  });
}

/**
 * True when `current` is editorially identical to the AI `original` — i.e. the reviewer changed nothing of
 * substance. When `original` is null/undefined (legacy drafts predating the guard, or an un-migrated column) we
 * CANNOT prove it's unchanged, so we return false (allow) — the guard is additive and never blocks legacy drafts.
 */
export function isEditorialContentUnchanged(current: BlogPost, original: BlogPost | null | undefined): boolean {
  if (!original) return false;
  return editorialFingerprint(current) === editorialFingerprint(original);
}
