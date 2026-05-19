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
export const blogImageSchema = z.object({
  url: z.string().min(1),
  altText: z.string().min(1).max(500),
  caption: z.string().max(500).optional(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  storageKey: z.string().optional(),
});

export const blogSectionSchema = z.object({
  heading: z.string(),
  content: z.array(z.string()),
  // Schema-ready for per-section illustrations. Commit N supports
  // hero + thumbnail only; section attachment lands in a later commit.
  image: blogImageSchema.optional(),
});

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
  // hero    — full-width article anchor used at the top of /blog/<slug>.
  // thumbnail — smaller representation for cards and OG metadata.
  hero: blogImageSchema.optional(),
  thumbnail: blogImageSchema.optional(),
});

export const blogPostsSchema = z.array(blogPostSchema);

export type BlogImage = z.infer<typeof blogImageSchema>;
export type BlogSection = z.infer<typeof blogSectionSchema>;
export type BlogPost = z.infer<typeof blogPostSchema>;
export type BlogCategory = z.infer<typeof blogCategorySchema>;
export type BlogRelatedProductCategory = z.infer<
  typeof blogRelatedProductCategorySchema
>;

export type BlogImageSlot = "hero" | "thumbnail";
export const BLOG_IMAGE_SLOTS: BlogImageSlot[] = ["hero", "thumbnail"];
export function isBlogImageSlot(value: string): value is BlogImageSlot {
  return (BLOG_IMAGE_SLOTS as string[]).includes(value);
}
