// Little Smiles concrete implementation of the ContentOps PublishAdapter.
// This file is project-specific — it imports lib/blog.ts and lib/products.ts
// directly. The engine (lib/contentops/) never imports this file. The
// wiring layer composes this adapter with engine functions.
//
// When a second project adopts ContentOps, copy this file as the basis
// for the new project's adapter and refactor both into
// lib/contentops-adapters/.

import { blogPosts } from "@/lib/blog";
import { type BlogPost } from "@/lib/contentops/blog-schema";
import { type Draft } from "@/lib/contentops/drafts-store";
import type {
  ExistingPostMetadata,
  ImageAvailabilityReport,
  PublishAdapter,
} from "@/lib/contentops/publish-types";
import { products } from "@/lib/products";

// Matches the line-wrap behavior observed in lib/blog.ts: long property
// values wrap to the next line; short ones stay inline. The threshold is
// calibrated against existing posts in lib/blog.ts.
const WRAP_THRESHOLD = 100;

function indent(level: number): string {
  return "  ".repeat(level);
}

function formatString(value: string): string {
  return JSON.stringify(value);
}

function formatStringList(items: string[], itemLevel: number): string {
  if (items.length === 0) return "[]";
  const inner = items
    .map((item) => `${indent(itemLevel)}${formatString(item)},`)
    .join("\n");
  return `[\n${inner}\n${indent(itemLevel - 1)}]`;
}

function formatSection(section: BlogPost["sections"][number], level: number): string {
  return [
    `${indent(level)}{`,
    `${indent(level + 1)}heading: ${formatString(section.heading)},`,
    `${indent(level + 1)}content: ${formatStringList(section.content, level + 2)},`,
    `${indent(level)}},`,
  ].join("\n");
}

function formatSections(sections: BlogPost["sections"], itemLevel: number): string {
  if (sections.length === 0) return "[]";
  const inner = sections.map((s) => formatSection(s, itemLevel)).join("\n");
  return `[\n${inner}\n${indent(itemLevel - 1)}]`;
}

function formatProperty(level: number, key: string, value: string): string[] {
  const inline = `${indent(level)}${key}: ${value},`;
  if (inline.length <= WRAP_THRESHOLD) {
    return [inline];
  }
  return [`${indent(level)}${key}:`, `${indent(level + 1)}${value},`];
}

function formatBlogPostLiteral(post: BlogPost): string {
  const lines: string[] = [];
  lines.push(`${indent(1)}{`);
  lines.push(...formatProperty(2, "slug", formatString(post.slug)));
  lines.push(...formatProperty(2, "title", formatString(post.title)));
  lines.push(...formatProperty(2, "description", formatString(post.description)));
  lines.push(...formatProperty(2, "category", formatString(post.category)));
  lines.push(
    ...formatProperty(2, "relatedProductCategory", formatString(post.relatedProductCategory)),
  );
  lines.push(...formatProperty(2, "publishedAt", formatString(post.publishedAt)));
  lines.push(...formatProperty(2, "readTime", formatString(post.readTime)));
  lines.push(`${indent(2)}keywords: ${formatStringList(post.keywords, 3)},`);
  lines.push(`${indent(2)}sections: ${formatSections(post.sections, 3)},`);
  lines.push(`${indent(2)}cta: {`);
  lines.push(`${indent(3)}label: ${formatString(post.cta.label)},`);
  lines.push(`${indent(3)}href: ${formatString(post.cta.href)},`);
  lines.push(`${indent(2)}},`);
  lines.push(`${indent(1)}},`);
  return lines.join("\n");
}

export const littleSmilesPublishAdapter: PublishAdapter = {
  async listExistingPostMetadata(): Promise<ExistingPostMetadata[]> {
    return blogPosts.map((post) => ({ slug: post.slug, title: post.title }));
  },

  buildInsertionObject(draft: Draft): BlogPost {
    // LS publishes the draft content verbatim — no transformation.
    return draft.content;
  },

  buildDiffText(insertion: BlogPost): string {
    return formatBlogPostLiteral(insertion);
  },

  reportImageAvailability(insertion: BlogPost): ImageAvailabilityReport {
    const inCategory = products.filter(
      (p) => p.category === insertion.relatedProductCategory,
    );
    if (inCategory.length === 0) {
      return {
        ok: false,
        reason: `No products in catalog match relatedProductCategory "${insertion.relatedProductCategory}".`,
      };
    }
    return { ok: true };
  },
};
