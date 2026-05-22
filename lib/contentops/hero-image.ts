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

export type HeroImageWorkflow = {
  /** The path actually consumed by JSON-LD / on-page hero today. */
  effectivePath: string | null;
  /** True when the reviewer explicitly chose a path (vs. auto-resolved). */
  isOverride: boolean;
  /** The auto-resolved path before any reviewer override is applied. */
  autoResolvedPath: string | null;
  effectiveMetrics: HeroImageMetrics | null;
  suggestions: HeroImageCandidate[];
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

  return {
    effectivePath,
    isOverride,
    autoResolvedPath,
    effectiveMetrics,
    suggestions,
    aiProvider: getAiImageProviderState(),
  };
}

/**
 * Whitelist guard for the hero-image API. Only allows paths that resolve
 * to a real product image already on disk. Rejects anything else to
 * prevent path traversal / arbitrary URL writes.
 */
export function isAllowedHeroImagePath(candidate: string): boolean {
  if (typeof candidate !== "string" || candidate.length === 0) return false;
  if (candidate.length > 256) return false;
  if (!candidate.startsWith("/")) return false;
  if (candidate.includes("..")) return false;
  return products.some((p) => p.image === candidate);
}
