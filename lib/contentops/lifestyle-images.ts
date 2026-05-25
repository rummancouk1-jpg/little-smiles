// Blog Lifestyle Image Library
//
// A small, hand-curated registry of non-product lifestyle images the
// reviewer can pick as a blog hero. Every entry is admin-approved by
// virtue of being added here — there is no auto-fetch, no scraping, no
// AI generation. Images live under `public/uploads/blog/lifestyle/` and
// must already exist on disk; missing files are filtered out at runtime
// so a half-populated manifest never breaks the panel.
//
// How to add a new lifestyle image:
//   1. Drop the file into `public/uploads/blog/lifestyle/<descriptive-name>.jpg`
//      (allowed: .jpg, .jpeg, .png, .webp, .avif).
//   2. Append an entry to `LIFESTYLE_IMAGE_MANIFEST` below.
//   3. Commit. The reviewer will see it in the Hero panel candidates.
//
// Why a TypeScript manifest (not a JSON file or filesystem scan)?
//   - Tags + use-case are editorial decisions — they belong in source
//     control alongside the binary, in a typed shape.
//   - Filesystem-only would have no way to carry tags; a JSON sidecar
//     would re-invent half of TypeScript's type checking.
//   - One line per image keeps the commit reviewable.

import { promises as fs } from "node:fs";
import path from "node:path";

import sharp from "sharp";

import type { BlogPost } from "@/lib/contentops/blog-schema";

export const LIFESTYLE_ROOT_DIR = "/uploads/blog/lifestyle/";

/**
 * The shape of a single lifestyle image entry. Kept small on purpose —
 * anything fancier (alt text variants, palette analysis, etc.) belongs
 * in a later iteration.
 */
export type LifestyleImageManifestEntry = {
  /** Filename only — resolved against LIFESTYLE_ROOT_DIR at runtime. */
  filename: string;
  /** Short human-readable title shown on the candidate card. */
  title: string;
  /**
   * Lowercase tags used by the matcher. Mix free-form descriptors and
   * any of our `BlogRelatedProductCategory` values written lowercase.
   * Examples: "swaddle", "feeding", "bodysuits", "newborn", "morning routine".
   */
  tags: string[];
  /** One sentence — when would a reviewer reach for this image? */
  useCase: string;
};

/**
 * Seed manifest.
 *
 * Ships empty by default. Drop files into public/uploads/blog/lifestyle/
 * and append entries here. The example object below is a template only —
 * remove the leading comment to activate it once the file exists.
 *
 * Example:
 * {
 *   filename: "swaddle-morning-light.jpg",
 *   title: "Morning swaddle with natural light",
 *   tags: ["swaddle", "morning routine", "newborn", "natural light"],
 *   useCase: "Hero for any swaddle / sleep-routine post needing warmth without showing a face.",
 * },
 */
export const LIFESTYLE_IMAGE_MANIFEST: LifestyleImageManifestEntry[] = [];

// ─── Image metrics (mirrors hero-image.ts verdict tones) ────────────────

export type LifestyleImageVerdict =
  | "vertical_ideal"
  | "square"
  | "horizontal_or_small"
  | "unreadable";

export type LifestyleImageMetrics = {
  width: number | null;
  height: number | null;
  ratio: number | null;
  verdict: LifestyleImageVerdict;
  note: string;
};

const PINTEREST_IDEAL_RATIO = 2 / 3;
const PINTEREST_RATIO_TOLERANCE = 0.05;
const PINTEREST_MIN_WIDTH = 1000;

function resolvePublicPath(imagePath: string): string {
  const relative = imagePath.startsWith("/") ? imagePath.slice(1) : imagePath;
  return path.join(process.cwd(), "public", relative);
}

async function readLifestyleMetrics(imagePath: string): Promise<LifestyleImageMetrics> {
  const absolute = resolvePublicPath(imagePath);
  try {
    const meta = await sharp(absolute).metadata();
    const width = typeof meta.width === "number" ? meta.width : null;
    const height = typeof meta.height === "number" ? meta.height : null;
    if (!width || !height) {
      return {
        width,
        height,
        ratio: null,
        verdict: "unreadable",
        note: "sharp could not extract width/height — image header may be malformed.",
      };
    }
    const ratio = width / height;
    if (
      ratio < PINTEREST_IDEAL_RATIO + PINTEREST_RATIO_TOLERANCE &&
      ratio > PINTEREST_IDEAL_RATIO - PINTEREST_RATIO_TOLERANCE
    ) {
      return {
        width,
        height,
        ratio,
        verdict: "vertical_ideal",
        note: `Within ±5% of Pinterest's 2:3 ideal (${width}×${height}).`,
      };
    }
    if (Math.abs(ratio - 1) <= PINTEREST_RATIO_TOLERANCE) {
      return {
        width,
        height,
        ratio,
        verdict: "square",
        note: `Square (${width}×${height}) — acceptable for pins; vertical performs better.`,
      };
    }
    if (ratio > 1) {
      return {
        width,
        height,
        ratio,
        verdict: "horizontal_or_small",
        note: `Horizontal (${width}×${height}) — Pinterest deprioritises wide images.`,
      };
    }
    if (width < PINTEREST_MIN_WIDTH) {
      return {
        width,
        height,
        ratio,
        verdict: "horizontal_or_small",
        note: `Below ${PINTEREST_MIN_WIDTH}px width — may render soft on Pinterest.`,
      };
    }
    return {
      width,
      height,
      ratio,
      verdict: "vertical_ideal",
      note: `Vertical (${width}×${height}).`,
    };
  } catch (err) {
    return {
      width: null,
      height: null,
      ratio: null,
      verdict: "unreadable",
      note: err instanceof Error ? err.message : "Unknown sharp error.",
    };
  }
}

// ─── Matching ───────────────────────────────────────────────────────────

const TITLE_STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "for", "with", "of", "to", "in", "on",
  "your", "you", "what", "how", "why", "when", "is", "are", "be", "vs",
  "best", "top", "new", "all", "any", "guide", "guide:", "this", "that",
  "these", "those", "pakistan", "2026", "2025",
]);

function titleTerms(post: BlogPost): string[] {
  return post.title
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !TITLE_STOPWORDS.has(t));
}

function normalizedKeywords(post: BlogPost): string[] {
  return post.keywords.map((k) => k.toLowerCase().trim()).filter(Boolean);
}

function scoreEntry(entry: LifestyleImageManifestEntry, post: BlogPost): number {
  const tags = entry.tags.map((t) => t.toLowerCase());
  const tagSet = new Set(tags);
  let score = 0;

  // Category match — strongest signal. We compare against the post's
  // relatedProductCategory in lowercase since tags are lowercase.
  if (tagSet.has(post.relatedProductCategory.toLowerCase())) {
    score += 3;
  }

  // Keyword match — any post keyword appearing as / inside a tag, or a
  // tag appearing inside a keyword phrase.
  const keywords = normalizedKeywords(post);
  for (const tag of tags) {
    for (const kw of keywords) {
      if (kw === tag || kw.includes(tag) || tag.includes(kw)) {
        score += 2;
        break;
      }
    }
  }

  // Title term match — word-level overlap.
  const terms = titleTerms(post);
  for (const tag of tags) {
    if (terms.includes(tag)) {
      score += 1;
    }
  }

  return score;
}

// ─── Public types + loader ──────────────────────────────────────────────

export type LifestyleImageCandidate = {
  filename: string;
  /** Full `/uploads/blog/lifestyle/...` path the API expects. */
  filePath: string;
  title: string;
  tags: string[];
  useCase: string;
  metrics: LifestyleImageMetrics;
  /** Computed match score — 0 means "generic fallback" bucket. */
  matchScore: number;
  /** Plain-English explanation for the candidate card. */
  matchReason: string;
};

const MAX_MATCHED = 8;
const MAX_FALLBACK = 4;

function buildMatchReason(score: number, post: BlogPost): string {
  if (score >= 5) return `Strong match (${score}) on ${post.relatedProductCategory} + keywords.`;
  if (score >= 3) return `Matches the post's product category (${post.relatedProductCategory}).`;
  if (score >= 1) return `Loose keyword / title overlap (score ${score}).`;
  return `Generic baby-care fallback — no direct overlap with this post.`;
}

/**
 * Resolve the lifestyle library for a given draft. Steps:
 *   1. For each manifest entry, confirm the file exists on disk.
 *      Missing files are silently dropped (so a half-populated manifest
 *      degrades gracefully).
 *   2. Score each surviving entry against the draft's category + keywords
 *      + title terms.
 *   3. Return the top matched entries, then a fallback bucket (lowest
 *      scoring images so the reviewer always sees *something* if the
 *      library is non-empty).
 *
 * This function never throws. If anything goes wrong reading metadata,
 * the image simply isn't surfaced.
 */
export async function buildLifestyleCandidatesForDraft(post: BlogPost): Promise<{
  matched: LifestyleImageCandidate[];
  fallback: LifestyleImageCandidate[];
  manifestSize: number;
  missingFiles: string[];
}> {
  const manifestSize = LIFESTYLE_IMAGE_MANIFEST.length;
  const missingFiles: string[] = [];

  const candidates: LifestyleImageCandidate[] = [];

  for (const entry of LIFESTYLE_IMAGE_MANIFEST) {
    const filePath = `${LIFESTYLE_ROOT_DIR}${entry.filename}`;
    const absolute = resolvePublicPath(filePath);

    // Cheap existence check first.
    try {
      const stat = await fs.stat(absolute);
      if (!stat.isFile()) {
        missingFiles.push(filePath);
        continue;
      }
    } catch {
      missingFiles.push(filePath);
      continue;
    }

    const metrics = await readLifestyleMetrics(filePath);
    const score = scoreEntry(entry, post);
    candidates.push({
      filename: entry.filename,
      filePath,
      title: entry.title,
      tags: entry.tags,
      useCase: entry.useCase,
      metrics,
      matchScore: score,
      matchReason: buildMatchReason(score, post),
    });
  }

  // Sort by score desc, then by title for deterministic ordering.
  candidates.sort((a, b) => {
    if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
    return a.title.localeCompare(b.title);
  });

  const matched = candidates.filter((c) => c.matchScore > 0).slice(0, MAX_MATCHED);
  const matchedFilenames = new Set(matched.map((c) => c.filename));
  const fallback = candidates
    .filter((c) => !matchedFilenames.has(c.filename))
    .slice(0, MAX_FALLBACK);

  return { matched, fallback, manifestSize, missingFiles };
}
