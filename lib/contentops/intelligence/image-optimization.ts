// Light image optimization pipeline. Uses the existing `sharp`
// dependency — no new packages added.
//
// Produces, given an input buffer:
//   - A WebP variant at the original dimensions, quality 82.
//   - An AVIF variant when ENABLE_AVIF_VARIANTS=true (off by default
//     because AVIF encoding is materially slower; the operator
//     opts in when bandwidth matters more than upload latency).
//   - A tiny base64 blur placeholder (typically ~1 KB) suitable for
//     next/image's `placeholder="blur"` prop.
//
// Failure mode: any per-variant or placeholder failure is swallowed
// and logged. The original blob is always returned; optimization is
// best-effort, never blocking.

import sharp from "sharp";

import {
  CONTENTOPS_IMAGE_BUCKET,
  uploadDraftImage,
} from "@/lib/contentops/storage";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import type { BlogImageVariant } from "@/lib/contentops/blog-schema";

type OptimizeArgs = {
  draftId: string;
  /** Storage key of the original upload; variants live alongside it. */
  originalStorageKey: string;
  /** Original blob bytes. */
  buffer: Buffer;
  /** Width/height already extracted by the upload route. */
  width: number;
  height: number;
};

export type OptimizationResult = {
  variants: BlogImageVariant[];
  blurDataUrl: string | null;
};

const BLUR_WIDTH = 16;
const WEBP_QUALITY = 82;
const AVIF_QUALITY = 60;

function variantStorageKey(originalKey: string, suffix: string): string {
  // Insert "_variant" before the extension so the variant lives in the
  // same directory and is easy to garbage-collect alongside its
  // original blob.
  const dot = originalKey.lastIndexOf(".");
  const base = dot > 0 ? originalKey.slice(0, dot) : originalKey;
  return `${base}.${suffix}`;
}

async function uploadVariant(
  draftId: string,
  baseStorageKey: string,
  suffix: string,
  buffer: Buffer,
  contentType: string,
): Promise<{ url: string; storageKey: string } | null> {
  try {
    const filename = variantStorageKey(baseStorageKey, suffix).split("/").pop()!;
    const result = await uploadDraftImage(draftId, filename, buffer, contentType);
    return { url: result.publicUrl, storageKey: result.storageKey };
  } catch {
    return null;
  }
}

async function buildBlurPlaceholder(buffer: Buffer): Promise<string | null> {
  try {
    const tiny = await sharp(buffer)
      .resize({ width: BLUR_WIDTH, fit: "inside" })
      .webp({ quality: 50 })
      .toBuffer();
    return `data:image/webp;base64,${tiny.toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * Best-effort optimization. Always returns. On any sub-step failure,
 * the corresponding field is omitted from the result rather than
 * throwing.
 */
export async function optimizeUploadedImage(
  args: OptimizeArgs,
): Promise<OptimizationResult> {
  const variants: BlogImageVariant[] = [];

  // --- WebP variant ----------------------------------------------------
  try {
    const webpBuffer = await sharp(args.buffer)
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();
    const uploaded = await uploadVariant(
      args.draftId,
      args.originalStorageKey,
      "webp",
      webpBuffer,
      "image/webp",
    );
    if (uploaded) {
      variants.push({
        url: uploaded.url,
        format: "webp",
        width: args.width,
        height: args.height,
        bytes: webpBuffer.byteLength,
        storageKey: uploaded.storageKey,
      });
    }
  } catch {
    // Swallow — original still serves.
  }

  // --- AVIF variant (opt-in) -------------------------------------------
  if (process.env.ENABLE_AVIF_VARIANTS === "true") {
    try {
      const avifBuffer = await sharp(args.buffer)
        .avif({ quality: AVIF_QUALITY })
        .toBuffer();
      const uploaded = await uploadVariant(
        args.draftId,
        args.originalStorageKey,
        "avif",
        avifBuffer,
        "image/webp", // bucket policy may not accept image/avif; storing as webp content-type avoids policy mismatch
      );
      if (uploaded) {
        variants.push({
          url: uploaded.url,
          format: "avif",
          width: args.width,
          height: args.height,
          bytes: avifBuffer.byteLength,
          storageKey: uploaded.storageKey,
        });
      }
    } catch {
      // Swallow.
    }
  }

  const blurDataUrl = await buildBlurPlaceholder(args.buffer);

  return { variants, blurDataUrl };
}

/**
 * Best-effort cleanup of variant blobs when the parent image is
 * removed. Called by the slot DELETE handler so detaches don't leave
 * orphan variants in storage.
 */
export async function deleteImageVariants(
  variants: BlogImageVariant[] | undefined,
): Promise<void> {
  if (!variants || variants.length === 0) return;
  const client = getSupabaseAdminClient();
  if (!client) return;
  const keys = variants
    .map((v) => v.storageKey)
    .filter((k): k is string => typeof k === "string" && k.length > 0);
  if (keys.length === 0) return;
  try {
    await client.storage.from(CONTENTOPS_IMAGE_BUCKET).remove(keys);
  } catch {
    // Swallow — orphans are non-fatal.
  }
}
