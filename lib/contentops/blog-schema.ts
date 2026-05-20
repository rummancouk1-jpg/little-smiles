// Single source of truth for blog content shape. Lives under `contentops/`
// because the future draft pipeline will validate AI output against it, but
// `lib/blog.ts` consumes it today so the existing blog stays the canonical
// example of what a valid post looks like.

import { z } from "zod";

export const blogCategorySchema = z.enum([
  "Newborn Care",
  "Buying Guide",
  "Feeding",
]);

export const blogRelatedProductCategorySchema = z.enum([
  "Swaddle",
  "Bodysuits",
  "Food Bag",
  "Bottle Case",
  "Feeding Cushion",
  "Bow Set",
  "Food Container",
]);

// BlogImage — content-shaped image metadata. Travels inside the BlogPost
// JSONB so images move atomically with the article through every state
// transition. The binary blob lives in Supabase Storage; this struct
// carries only the metadata the renderer needs (URL, accessibility text,
// dimensions for layout reservation) plus an internal storageKey that the
// admin API uses to manage the blob lifecycle.
//
// storageKey is optional because static-seed posts reference public/
// assets without a managed blob behind them.
//
// Phase 5 additions (all optional, backward compatible):
//   - variants        Auto-generated alternate-format renditions (WebP,
//                     AVIF) produced by the post-upload optimizer. The
//                     renderer prefers a variant when present but falls
//                     back to `url` cleanly when absent.
//   - blurDataUrl     Tiny base64-encoded blur placeholder produced by
//                     sharp. Improves LCP perception when next/image
//                     consumes it via `placeholder="blur"`.
//   - bytes           Bytes of the original blob. Used by the Media
//                     Manager diagnostics card.
//   - generatedBy     Provider id when the image was produced by the
//                     AI generator (`openai` · `flux` · `imagen` ·
//                     `ideogram`). Null/undefined for operator uploads.
export const blogImageVariantSchema = z.object({
  url: z.string().min(1),
  format: z.enum(["webp", "avif"]),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  bytes: z.number().int().nonnegative().optional(),
  storageKey: z.string().optional(),
});

export const blogImageSchema = z.object({
  url: z.string().min(1),
  altText: z.string().min(1).max(500),
  caption: z.string().max(500).optional(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  storageKey: z.string().optional(),
  variants: z.array(blogImageVariantSchema).optional(),
  blurDataUrl: z.string().min(1).optional(),
  bytes: z.number().int().nonnegative().optional(),
  generatedBy: z
    .enum(["openai", "flux", "imagen", "ideogram"])
    .optional(),
});

export const blogSectionSchema = z.object({
  heading: z.string(),
  content: z.array(z.string()),
  // Schema-ready for per-section illustrations. Commit N supports
  // hero + thumbnail only; section attachment lands in a later commit.
  image: blogImageSchema.optional(),
});

// Deterministic image-generation prompts attached to every freshly
// generated draft. The composer that fills these in lives at
// lib/contentops/intelligence/image-prompts.ts. Operator copies them
// into their image tool (Midjourney / Imagen / Flux) — or with Phase 5
// wired in, the in-app generator calls the configured provider directly.
//
// `pinterest` is optional in storage because pre-Phase-5 drafts don't
// carry it; the composer always fills it for new drafts.
export const blogImagePromptsSchema = z.object({
  hero: z.string().min(1).max(2000),
  thumbnail: z.string().min(1).max(2000),
  og: z.string().min(1).max(2000),
  pinterest: z.string().min(1).max(2000).optional(),
  generatedAt: z.string(),
  /** Free-form palette tag the composer used. Useful for regeneration UX. */
  paletteVersion: z.string().min(1).max(50),
});

export type BlogImagePrompts = z.infer<typeof blogImagePromptsSchema>;

export const blogPostSchema = z.object({
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  category: blogCategorySchema,
  relatedProductCategory: blogRelatedProductCategorySchema,
  publishedAt: z.string(),
  readTime: z.string(),
  keywords: z.array(z.string()),
  sections: z.array(blogSectionSchema),
  cta: z.object({
    label: z.string(),
    href: z.string(),
  }),
  // Optional. Static-seed posts have no images and remain valid.
  // hero      — full-width article anchor used at the top of /blog/<slug>.
  // thumbnail — smaller representation for cards.
  // og        — 1200×630 social card. Falls back to hero when absent.
  // pinterest — 2:3 vertical pin for Pinterest discoverability.
  hero: blogImageSchema.optional(),
  thumbnail: blogImageSchema.optional(),
  og: blogImageSchema.optional(),
  pinterest: blogImageSchema.optional(),
  /**
   * Optional Pinterest-specific copy. Composed by the Pinterest
   * intelligence layer at draft creation; operator-editable from the
   * media page's Pinterest SEO card.
   */
  pinterestSeo: z
    .object({
      title: z.string().min(1).max(100),
      description: z.string().min(1).max(500),
    })
    .optional(),
  /**
   * Auto-generated image prompts attached at draft creation time. Optional
   * so static-seed posts (no images, no prompts) stay valid and so older
   * drafts created before Commit AA don't break schema validation on read.
   */
  imagePrompts: blogImagePromptsSchema.optional(),
});

export const blogPostsSchema = z.array(blogPostSchema);

export type BlogImage = z.infer<typeof blogImageSchema>;
export type BlogSection = z.infer<typeof blogSectionSchema>;
export type BlogPost = z.infer<typeof blogPostSchema>;
export type BlogCategory = z.infer<typeof blogCategorySchema>;
export type BlogRelatedProductCategory = z.infer<
  typeof blogRelatedProductCategorySchema
>;

export type BlogImageVariant = z.infer<typeof blogImageVariantSchema>;

// Phase 5 expands the slot enum. Each slot maps 1:1 to a key on
// BlogPost. The image API routes accept any value here.
export type BlogImageSlot = "hero" | "thumbnail" | "og" | "pinterest";
export const BLOG_IMAGE_SLOTS: BlogImageSlot[] = [
  "hero",
  "thumbnail",
  "og",
  "pinterest",
];
export function isBlogImageSlot(value: string): value is BlogImageSlot {
  return (BLOG_IMAGE_SLOTS as string[]).includes(value);
}

// Recommended pixel dimensions per slot. The image generator and the
// Pinterest card both consult this so the prompt + provider call line
// up with what next/image renders downstream.
export const SLOT_DIMENSIONS: Record<
  BlogImageSlot,
  { width: number; height: number; aspect: "16:9" | "1:1" | "1200x630" | "2:3" }
> = {
  hero: { width: 1600, height: 900, aspect: "16:9" },
  thumbnail: { width: 800, height: 800, aspect: "1:1" },
  og: { width: 1200, height: 630, aspect: "1200x630" },
  pinterest: { width: 1000, height: 1500, aspect: "2:3" },
};
