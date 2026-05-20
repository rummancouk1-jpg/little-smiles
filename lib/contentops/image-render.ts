// Small render-side resolver for BlogImage. Picks the best variant for
// the renderer (prefer WebP when present) and surfaces blur-placeholder
// metadata in the shape next/image expects. Pure function — used by
// HeroFigure, SectionFigure, MediaConfidence, MediaUploader, and the
// Pinterest preview.

import type { BlogImage } from "@/lib/contentops/blog-schema";

export type ResolvedBlogImage = {
  src: string;
  blurDataURL?: string;
};

export function resolveBlogImageSrc(image: BlogImage): ResolvedBlogImage {
  // Prefer the WebP variant when one is present — it's already in
  // storage from the upload-time optimizer and shaves serious bytes
  // off LCP on hero rendering.
  const webp = image.variants?.find((v) => v.format === "webp");
  const src = webp?.url ?? image.url;
  return {
    src,
    blurDataURL: image.blurDataUrl,
  };
}
