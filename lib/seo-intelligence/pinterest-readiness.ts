// Pinterest readiness intelligence. Reads real image files from /public
// via sharp, evaluates pin-friendliness from actual dimensions, and checks
// title/description quality from the live blog + product data. Never
// fabricates a score — every verdict references the dimensions or string
// lengths it derived from.

import { promises as fs } from "node:fs";
import path from "node:path";

import sharp from "sharp";

import { blogPosts, getBlogAnchorProduct, type BlogPost } from "@/lib/blog";
import { products, type Product } from "@/lib/products";

import type { Diagnostic, SubjectReport } from "@/lib/seo-intelligence/types";

// Pinterest's published guidance: vertical 2:3 (e.g. 1000×1500) is the
// optimal pin ratio; 1:1 still works; horizontal pins are deprioritised.
const IDEAL_RATIO = 2 / 3;
const RATIO_TOLERANCE = 0.05;
const MIN_RECOMMENDED_WIDTH = 1000;

const PIN_TITLE_MIN = 30;
const PIN_TITLE_MAX = 100;
const PIN_DESC_MIN = 100;
const PIN_DESC_MAX = 500;

export type ImageVerdict = "vertical_ideal" | "square" | "horizontal_or_small" | "missing" | "unreadable";

export type ImageMetrics = {
  filePath: string;
  width: number | null;
  height: number | null;
  ratio: number | null;
  modifiedAt: string | null;
  verdict: ImageVerdict;
  notes: string;
};

export type PinterestSubjectReport = SubjectReport & {
  image: ImageMetrics;
};

export type PinterestReadinessReport = {
  blogReports: PinterestSubjectReport[];
  productReports: PinterestSubjectReport[];
  globalDiagnostics: Diagnostic[];
};

function resolvePublicPath(imagePath: string): string {
  const cwd = process.cwd();
  const relative = imagePath.startsWith("/") ? imagePath.slice(1) : imagePath;
  return path.join(cwd, "public", relative);
}

async function readImageMetrics(imagePath: string): Promise<ImageMetrics> {
  const absolute = resolvePublicPath(imagePath);
  let stat: Awaited<ReturnType<typeof fs.stat>> | null = null;
  try {
    stat = await fs.stat(absolute);
  } catch {
    return {
      filePath: imagePath,
      width: null,
      height: null,
      ratio: null,
      modifiedAt: null,
      verdict: "missing",
      notes: `File not found at public${imagePath}.`,
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
        modifiedAt: stat.mtime.toISOString(),
        verdict: "unreadable",
        notes: "sharp could not extract width/height — image header may be malformed.",
      };
    }
    const ratio = width / height;
    let verdict: ImageVerdict = "horizontal_or_small";
    let notes = "";

    if (ratio < IDEAL_RATIO + RATIO_TOLERANCE && ratio > IDEAL_RATIO - RATIO_TOLERANCE) {
      verdict = "vertical_ideal";
      notes = "Within ±5% of Pinterest's 2:3 ideal.";
    } else if (Math.abs(ratio - 1) <= RATIO_TOLERANCE) {
      verdict = "square";
      notes = "Square (1:1) — acceptable for pins but vertical performs better.";
    } else if (ratio > 1) {
      verdict = "horizontal_or_small";
      notes = `Horizontal (${width}×${height}) — Pinterest deprioritises wide images.`;
    } else {
      verdict = "horizontal_or_small";
      notes = `Vertical but off-ratio (${width}×${height}; ratio ${ratio.toFixed(2)}) — closest pin ratio is 2:3 (0.67).`;
    }

    if (width < MIN_RECOMMENDED_WIDTH) {
      notes = `${notes} Width ${width}px is below the ${MIN_RECOMMENDED_WIDTH}px recommendation; pins may downscale poorly.`;
      if (verdict === "vertical_ideal" || verdict === "square") {
        verdict = "horizontal_or_small";
      }
    }

    return {
      filePath: imagePath,
      width,
      height,
      ratio,
      modifiedAt: stat.mtime.toISOString(),
      verdict,
      notes,
    };
  } catch (err) {
    return {
      filePath: imagePath,
      width: null,
      height: null,
      ratio: null,
      modifiedAt: stat.mtime.toISOString(),
      verdict: "unreadable",
      notes: `sharp error: ${err instanceof Error ? err.message : "unknown"}.`,
    };
  }
}

function checkTitleLength(title: string): Diagnostic | null {
  const length = title.length;
  if (length < PIN_TITLE_MIN) {
    return {
      severity: "warning",
      message: `Pin title is ${length} characters — below the ${PIN_TITLE_MIN}-char Pinterest minimum.`,
      derivation: `title.length = ${length}; Pinterest truncates very short titles in feeds.`,
      hint: "Lengthen so the value prop is clear at a glance.",
    };
  }
  if (length > PIN_TITLE_MAX) {
    return {
      severity: "info",
      message: `Pin title is ${length} characters — Pinterest truncates after ${PIN_TITLE_MAX}.`,
      derivation: `title.length = ${length}; characters past ${PIN_TITLE_MAX} are clipped in Pinterest UI.`,
      hint: "Tighten or front-load the most important keyword.",
    };
  }
  return null;
}

function checkDescriptionLength(description: string): Diagnostic | null {
  const length = description.length;
  if (length < PIN_DESC_MIN) {
    return {
      severity: "info",
      message: `Pin description is ${length} characters — below the ${PIN_DESC_MIN}-char comfort minimum.`,
      derivation: `description.length = ${length}; short descriptions lose SEO + Pinterest search signal.`,
    };
  }
  if (length > PIN_DESC_MAX) {
    return {
      severity: "info",
      message: `Pin description is ${length} characters — Pinterest typically caps at ${PIN_DESC_MAX}.`,
      derivation: `description.length = ${length}; risk of truncation in pin detail view.`,
    };
  }
  return null;
}

function checkImageVerdict(metrics: ImageMetrics): Diagnostic | null {
  switch (metrics.verdict) {
    case "missing":
      return {
        severity: "critical",
        message: `Hero image file missing.`,
        derivation: metrics.notes,
        hint: "Restore the asset under /public or update the slug's image path.",
      };
    case "unreadable":
      return {
        severity: "warning",
        message: `Hero image header could not be read.`,
        derivation: metrics.notes,
      };
    case "horizontal_or_small":
      return {
        severity: "warning",
        message: `Hero image not pin-friendly.`,
        derivation: `${metrics.width}×${metrics.height}, ratio ${(metrics.ratio ?? 0).toFixed(2)}. ${metrics.notes}`,
        hint: "Generate a 2:3 (1000×1500) Pinterest variant separately — keep this asset for site use.",
      };
    case "square":
      return {
        severity: "info",
        message: "Hero image is square — acceptable for pins, but vertical performs better.",
        derivation: metrics.notes,
      };
    case "vertical_ideal":
      return null;
  }
}

function checkImageFreshness(metrics: ImageMetrics, publishedAt: string | null): Diagnostic | null {
  if (!metrics.modifiedAt) return null;
  if (!publishedAt) return null;
  const imageAge = Date.now() - new Date(metrics.modifiedAt).getTime();
  const contentAge = Date.now() - new Date(publishedAt).getTime();
  if (!Number.isFinite(imageAge) || !Number.isFinite(contentAge)) return null;
  const imageOlderByDays = (contentAge - imageAge) / 86_400_000;
  if (imageOlderByDays > 30) {
    return {
      severity: "info",
      message: "Hero image is older than the post by more than 30 days.",
      derivation: `Image mtime ${metrics.modifiedAt} vs publishedAt ${publishedAt} — gap ${Math.round(imageOlderByDays)} days.`,
      hint: "Consider refreshing the asset so social previews don't reuse a stale image.",
    };
  }
  return null;
}

async function buildBlogPinterestReport(post: BlogPost): Promise<PinterestSubjectReport> {
  const anchor = getBlogAnchorProduct(post);
  const imagePath = anchor?.image ?? "/products/logo.png";
  const metrics = await readImageMetrics(imagePath);

  const diagnostics: Diagnostic[] = [];
  const titleD = checkTitleLength(post.title);
  if (titleD) diagnostics.push(titleD);
  const descD = checkDescriptionLength(post.description);
  if (descD) diagnostics.push(descD);
  const imageD = checkImageVerdict(metrics);
  if (imageD) diagnostics.push(imageD);
  const freshD = checkImageFreshness(metrics, post.publishedAt);
  if (freshD) diagnostics.push(freshD);

  if (!anchor) {
    diagnostics.push({
      severity: "warning",
      message: "Blog has no anchor product — falling back to logo for pin image.",
      derivation: "getBlogAnchorProduct() returned null; OG/Pinterest preview reuses /products/logo.png.",
      hint: "Add a product in the related category to unlock a topical pin image.",
    });
  }

  return {
    subject: { kind: "blog", slug: post.slug, title: post.title },
    diagnostics,
    image: metrics,
  };
}

async function buildProductPinterestReport(product: Product): Promise<PinterestSubjectReport> {
  const metrics = await readImageMetrics(product.image);
  const diagnostics: Diagnostic[] = [];
  const titleD = checkTitleLength(product.name);
  if (titleD) diagnostics.push(titleD);
  const descD = checkDescriptionLength(product.shortDescription || product.description);
  if (descD) diagnostics.push(descD);
  const imageD = checkImageVerdict(metrics);
  if (imageD) diagnostics.push(imageD);

  return {
    subject: { kind: "product", slug: product.slug, title: product.name },
    diagnostics,
    image: metrics,
  };
}

export async function buildPinterestReadinessReport(): Promise<PinterestReadinessReport> {
  const [blogReports, productReports] = await Promise.all([
    Promise.all(blogPosts.map(buildBlogPinterestReport)),
    Promise.all(products.map(buildProductPinterestReport)),
  ]);

  const globalDiagnostics: Diagnostic[] = [];
  const verticalCount = productReports.filter((r) => r.image.verdict === "vertical_ideal").length;
  const total = productReports.length;
  if (total > 0 && verticalCount === 0) {
    globalDiagnostics.push({
      severity: "info",
      message: "No product asset is in Pinterest's vertical 2:3 sweet spot.",
      derivation: `Scanned ${total} product hero images via sharp; zero matched ratio 0.67 ± 0.05.`,
      hint: "Catalog photography is square — generate a per-product vertical pin variant separately when you want to scale Pinterest.",
    });
  }

  return { blogReports, productReports, globalDiagnostics };
}
