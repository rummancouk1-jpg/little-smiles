// Local content decay signals. Every metric here is derived from the
// repo (lib/blog.ts) or local image filesystem state. This engine does
// NOT and CANNOT compute traffic-, impression-, or CTR-decay — those
// require GSC / GA4 server reads. The provider scaffolds expose where
// the missing data should land when credentials arrive.

import { promises as fs } from "node:fs";
import path from "node:path";

import { blogPosts, getBlogAnchorProduct, type BlogPost } from "@/lib/blog";

import type { Diagnostic, SubjectReport } from "@/lib/seo-intelligence/types";

const STALE_AGE_DAYS_WARN = 180;
const STALE_AGE_DAYS_INFO = 90;
const MIN_WORD_COUNT_WARN = 350;
const MIN_SECTIONS = 3;

export type DecaySubjectReport = SubjectReport & {
  ageInDays: number;
  wordCount: number;
  sectionCount: number;
  imageModifiedAt: string | null;
  hasAnchorProduct: boolean;
};

export type ContentDecayReport = {
  blogReports: DecaySubjectReport[];
  /** Honest acknowledgement of what local data cannot tell us. */
  knownBlindSpots: string[];
};

function countWords(post: BlogPost): number {
  return post.sections.reduce((sum, section) => {
    const sectionWords = section.content.reduce((s, paragraph) => s + paragraph.trim().split(/\s+/).length, 0);
    return sum + sectionWords;
  }, 0);
}

function publishedAgeInDays(publishedAt: string): number {
  const t = new Date(`${publishedAt}T12:00:00+05:00`).getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

async function readImageMTime(imagePath: string): Promise<string | null> {
  try {
    const absolute = path.join(process.cwd(), "public", imagePath.startsWith("/") ? imagePath.slice(1) : imagePath);
    const stat = await fs.stat(absolute);
    return stat.mtime.toISOString();
  } catch {
    return null;
  }
}

async function buildBlogDecayReport(post: BlogPost): Promise<DecaySubjectReport> {
  const diagnostics: Diagnostic[] = [];
  const ageInDays = publishedAgeInDays(post.publishedAt);
  const wordCount = countWords(post);
  const sectionCount = post.sections.length;
  const anchor = getBlogAnchorProduct(post);
  const imageModifiedAt = anchor ? await readImageMTime(anchor.image) : null;

  if (ageInDays > STALE_AGE_DAYS_WARN) {
    diagnostics.push({
      severity: "warning",
      message: `Published ${ageInDays} days ago — older than ${STALE_AGE_DAYS_WARN}-day threshold.`,
      derivation: `publishedAt = ${post.publishedAt}; today = ${new Date().toISOString().slice(0, 10)}.`,
      hint: "Refresh dates, examples, or expand sections to signal freshness.",
    });
  } else if (ageInDays > STALE_AGE_DAYS_INFO) {
    diagnostics.push({
      severity: "info",
      message: `Published ${ageInDays} days ago — review before it crosses the ${STALE_AGE_DAYS_WARN}-day stale threshold.`,
      derivation: `publishedAt = ${post.publishedAt}.`,
    });
  }

  if (wordCount < MIN_WORD_COUNT_WARN) {
    diagnostics.push({
      severity: "warning",
      message: `Word count ${wordCount} is below the ${MIN_WORD_COUNT_WARN}-word minimum we target for editorial depth.`,
      derivation: `Sum of section.content paragraph word counts = ${wordCount}.`,
      hint: "Add one more section or deepen an existing one — quality over filler.",
    });
  }

  if (sectionCount < MIN_SECTIONS) {
    diagnostics.push({
      severity: "warning",
      message: `Only ${sectionCount} section(s) — below the ${MIN_SECTIONS}-section minimum.`,
      derivation: `post.sections.length = ${sectionCount}.`,
      hint: "Three-section structure (problem · approach · action) is the boutique default.",
    });
  }

  if (anchor && !anchor.inStock) {
    diagnostics.push({
      severity: "info",
      message: `Anchor product "${anchor.name}" is out of stock.`,
      derivation: "anchor.inStock = false; CTA still works but visual signal is weakened.",
      hint: "Restock or swap the anchor by adjusting featured/in-stock flags in catalog.",
    });
  }

  // No fabricated traffic / CTR / impression signals. Surface that gap
  // honestly so the reader knows what would normally appear here.
  diagnostics.push({
    severity: "info",
    message: "Traffic, impressions, and CTR decay signals require Search Console / GA4.",
    derivation: "Local repo data alone cannot answer 'is this post losing impressions over time?'",
    hint: "Connect GSC + GA4 credentials (see /admin/readiness) to enable this signal.",
  });

  return {
    subject: { kind: "blog", slug: post.slug, title: post.title },
    diagnostics,
    ageInDays,
    wordCount,
    sectionCount,
    imageModifiedAt,
    hasAnchorProduct: Boolean(anchor),
  };
}

export async function buildContentDecayReport(): Promise<ContentDecayReport> {
  const blogReports = await Promise.all(blogPosts.map(buildBlogDecayReport));
  return {
    blogReports,
    knownBlindSpots: [
      "Traffic decline by URL — requires GA4 Data API.",
      "Impression / CTR decline by query — requires Search Console.",
      "Bounce / engagement decline — requires GA4 + event configuration.",
      "Backlink loss — requires an external SEO data source (e.g. Ahrefs, Moz).",
    ],
  };
}
