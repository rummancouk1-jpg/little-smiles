// Hero-image workflow helpers for the ContentOps draft review surface.
//
// Resolves the effective hero image for a draft (reviewer override OR the
// auto-anchor product image), proposes candidate images strictly from the
// existing product catalog (no fabrication), and inspects each candidate's
// dimensions on disk via sharp so the reviewer can see real Pinterest
// pin-readiness verdicts before picking one.
//
// AI image generation is intentionally placeholder-only: this module
// returns whether an AI provider is configured via env var. It NEVER calls
// out to any external image generation API.

import { promises as fs } from "node:fs";
import path from "node:path";

import sharp from "sharp";

import { getBlogAnchorProduct } from "@/lib/blog";
import { type Draft } from "@/lib/contentops/drafts-store";
import {
  buildLifestyleCandidatesForDraft,
  LIFESTYLE_ROOT_DIR,
  type LifestyleImageCandidate,
} from "@/lib/contentops/lifestyle-images";
import { products, type Product } from "@/lib/products";

const PINTEREST_IDEAL_RATIO = 2 / 3;
const PINTEREST_RATIO_TOLERANCE = 0.05;
const PINTEREST_MIN_WIDTH = 1000;

export type HeroImageVerdict =
  | "vertical_ideal"
  | "square"
  | "horizontal_or_small"
  | "missing"
  | "unreadable";

export type HeroImageMetrics = {
  filePath: string;
  width: number | null;
  height: number | null;
  ratio: number | null;
  verdict: HeroImageVerdict;
  note: string;
};

export type HeroImageCandidate = {
  productSlug: string;
  productName: string;
  category: string;
  inStock: boolean;
  featured: boolean;
  bestSeller: boolean;
  /** Why this candidate was surfaced (e.g. "same category", "featured fallback"). */
  reason: string;
  metrics: HeroImageMetrics;
};

export type AiImageProviderState =
  | { configured: false; reason: string }
  | { configured: true; provider: string };

export type LifestyleCandidatesBundle = {
  matched: LifestyleImageCandidate[];
  fallback: LifestyleImageCandidate[];
  manifestSize: number;
  missingFiles: string[];
  /** The directory under public/ the reviewer should drop new files into. */
  rootDir: string;
};

export type HeroImageWorkflow = {
  /** The path actually consumed by JSON-LD / on-page hero today. */
  effectivePath: string | null;
  /** True when the reviewer explicitly chose a path (vs. auto-resolved). */
  isOverride: boolean;
  /** The auto-resolved path before any reviewer override is applied. */
  autoResolvedPath: string | null;
  effectiveMetrics: HeroImageMetrics | null;
  /** Product/catalog candidates — same shape as before. */
  suggestions: HeroImageCandidate[];
  /** Blog Lifestyle Image Library candidates (admin-curated, non-product). */
  lifestyle: LifestyleCandidatesBundle;
  aiProvider: AiImageProviderState;
};

function resolvePublicPath(imagePath: string): string {
  const relative = imagePath.startsWith("/") ? imagePath.slice(1) : imagePath;
  return path.join(process.cwd(), "public", relative);
}

async function readMetrics(imagePath: string): Promise<HeroImageMetrics> {
  const absolute = resolvePublicPath(imagePath);
  try {
    await fs.stat(absolute);
  } catch {
    return {
      filePath: imagePath,
      width: null,
      height: null,
      ratio: null,
      verdict: "missing",
      note: `File not found at public${imagePath}.`,
    };
  }

  try {
    const meta = await sharp(absolute).metadata();
    const width = typeof meta.width === "number" ? meta.width : null;
    const height = typeof meta.height === "number" ? meta.height : null;
    if (!width || !height) {
      return {
        filePath: imagePath,
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
        filePath: imagePath,
        width,
        height,
        ratio,
        verdict: "vertical_ideal",
        note: `Within ±5% of Pinterest's 2:3 ideal (${width}×${height}).`,
      };
    }
    if (Math.abs(ratio - 1) <= PINTEREST_RATIO_TOLERANCE) {
      return {
        filePath: imagePath,
        width,
        height,
        ratio,
        verdict: "square",
        note: `Square (${width}×${height}) — acceptable for pins; vertical performs better.`,
      };
    }
    if (ratio > 1) {
      return {
        filePath: imagePath,
        width,
        height,
        ratio,
        verdict: "horizontal_or_small",
        note: `Horizontal (${width}×${height}) — Pinterest deprioritises wide images.`,
      };
    }
    if (width < PINTEREST_MIN_WIDTH) {
      return {
        filePath: imagePath,
        width,
        height,
        ratio,
        verdict: "horizontal_or_small",
        note: `Below ${PINTEREST_MIN_WIDTH}px width — may render soft on Pinterest.`,
      };
    }
    return {
      filePath: imagePath,
      width,
      height,
      ratio,
      verdict: "vertical_ideal",
      note: `Vertical (${width}×${height}).`,
    };
  } catch (err) {
    return {
      filePath: imagePath,
      width: null,
      height: null,
      ratio: null,
      verdict: "unreadable",
      note: err instanceof Error ? err.message : "Unknown sharp error.",
    };
  }
}

function buildCandidate(product: Product, reason: string, metrics: HeroImageMetrics): HeroImageCandidate {
  return {
    productSlug: product.slug,
    productName: product.name,
    category: product.category,
    inStock: product.inStock,
    featured: Boolean(product.featured),
    bestSeller: Boolean(product.bestSeller),
    reason,
    metrics,
  };
}

function getAiImageProviderState(): AiImageProviderState {
  const provider = process.env.CONTENTOPS_AI_IMAGE_PROVIDER?.trim();
  if (provider && provider.length > 0) {
    return { configured: true, provider };
  }
  return {
    configured: false,
    reason: "Set CONTENTOPS_AI_IMAGE_PROVIDER to enable. Generation is OFF by default to protect production budget.",
  };
}

/**
 * Build the full hero-image workflow snapshot for a draft. All metadata
 * comes from real product images on disk; nothing is fabricated.
 */
export async function buildHeroImageWorkflow(draft: Draft): Promise<HeroImageWorkflow> {
  const post = draft.content;
  const anchor = getBlogAnchorProduct(post);
  const autoResolvedPath = anchor?.image ?? null;
  const overridePath = draft.hero_image_path && draft.hero_image_path.length > 0 ? draft.hero_image_path : null;
  const effectivePath = overridePath ?? autoResolvedPath;
  const isOverride = Boolean(overridePath);

  // Candidate pool — same-category in-stock products first, then any
  // in-category featured/best-seller, then 3 cross-category fallbacks.
  const sameCategory = products.filter(
    (p) => p.category === post.relatedProductCategory && p.image && p.image.length > 0,
  );
  const sameInStock = sameCategory.filter((p) => p.inStock);
  const sameOutOfStock = sameCategory.filter((p) => !p.inStock);
  const featuredOutside = products
    .filter((p) => p.category !== post.relatedProductCategory)
    .filter((p) => (p.featured || p.bestSeller) && p.inStock)
    .slice(0, 3);

  const seen = new Set<string>();
  const ordered: Array<{ product: Product; reason: string }> = [];
  for (const p of sameInStock) {
    if (seen.has(p.image)) continue;
    seen.add(p.image);
    ordered.push({
      product: p,
      reason: `Same category (${p.category}); in stock${p.featured ? "; featured" : ""}.`,
    });
  }
  for (const p of sameOutOfStock) {
    if (seen.has(p.image)) continue;
    seen.add(p.image);
    ordered.push({ product: p, reason: `Same category (${p.category}); out of stock — visual only.` });
  }
  for (const p of featuredOutside) {
    if (seen.has(p.image)) continue;
    seen.add(p.image);
    ordered.push({ product: p, reason: `Cross-category fallback (${p.category}); featured/best-seller.` });
  }

  const suggestionMetrics = await Promise.all(
    ordered.map(({ product }) => readMetrics(product.image)),
  );
  const suggestions: HeroImageCandidate[] = ordered.map(({ product, reason }, idx) =>
    buildCandidate(product, reason, suggestionMetrics[idx]),
  );

  const effectiveMetrics = effectivePath ? await readMetrics(effectivePath) : null;

  // Lifestyle library — admin-curated, separate bucket from product
  // candidates. Same propagation pipeline; the existing acceptance route
  // already accepts paths under public/ that exist on disk.
  const lifestyleBundle = await buildLifestyleCandidatesForDraft(post);

  return {
    effectivePath,
    isOverride,
    autoResolvedPath,
    effectiveMetrics,
    suggestions,
    lifestyle: {
      ...lifestyleBundle,
      rootDir: LIFESTYLE_ROOT_DIR,
    },
    aiProvider: getAiImageProviderState(),
  };
}

/**
 * Synchronous shape/safety check shared by the catalog check and the
 * filesystem check. Catches the obvious bad inputs (traversal, scheme,
 * absurd length) before any disk hit.
 */
function passesShapeGuard(candidate: string): boolean {
  if (typeof candidate !== "string" || candidate.length === 0) return false;
  if (candidate.length > 256) return false;
  if (!candidate.startsWith("/")) return false;
  if (candidate.startsWith("//")) return false;
  if (candidate.includes("..")) return false;
  if (candidate.includes("\0")) return false;
  return true;
}

/**
 * Allowed image extensions for reviewer-uploaded heroes. Conservative on
 * purpose — anything not on this list (videos, SVGs, raw text) is rejected
 * even if the file exists. Matches what Next/Image happily renders.
 */
const ALLOWED_HERO_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);

function hasAllowedExtension(candidate: string): boolean {
  const lower = candidate.toLowerCase();
  for (const ext of ALLOWED_HERO_EXTENSIONS) {
    if (lower.endsWith(ext)) return true;
  }
  return false;
}

/**
 * Catalog-only synchronous check. Kept for callers that want to confirm
 * a path is a known product image without touching disk.
 */
export function isAllowedHeroImagePath(candidate: string): boolean {
  if (!passesShapeGuard(candidate)) return false;
  return products.some((p) => p.image === candidate);
}

/**
 * Full hero-image acceptance check used by the admin POST route.
 * Accepts either:
 *   1. a known catalog product image (synchronous), OR
 *   2. any other `/...` path under `public/` that actually exists on disk
 *      AND carries an allowed image extension.
 *
 * Option 2 unlocks the manual reviewer-approved image flow (e.g. an admin
 * drops an externally-produced AI image into `public/uploads/blog/foo.jpg`
 * and selects it from the dashboard). We deliberately do NOT allow
 * absolute http(s) URLs — every hero must live in our own asset tree so
 * it survives third-party outages and Next/Image can optimise it.
 */
export async function resolveHeroImagePathAcceptance(
  candidate: string,
): Promise<{ ok: true; reason: "catalog" | "uploaded" } | { ok: false; error: string }> {
  if (!passesShapeGuard(candidate)) {
    return { ok: false, error: "Path failed shape guard (must start with '/', no '..', no scheme)." };
  }
  if (products.some((p) => p.image === candidate)) {
    return { ok: true, reason: "catalog" };
  }
  if (!hasAllowedExtension(candidate)) {
    return {
      ok: false,
      error: `Extension not allowed. Use one of: ${Array.from(ALLOWED_HERO_EXTENSIONS).join(", ")}.`,
    };
  }
  const absolute = resolvePublicPath(candidate);
  try {
    const stat = await fs.stat(absolute);
    if (!stat.isFile()) {
      return { ok: false, error: `Path exists but is not a regular file: public${candidate}.` };
    }
    return { ok: true, reason: "uploaded" };
  } catch {
    return {
      ok: false,
      error: `No file at public${candidate}. Drop an approved image into public/... first, then enter the path.`,
    };
  }
}
