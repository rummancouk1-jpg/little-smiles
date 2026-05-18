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

export const blogSectionSchema = z.object({
  heading: z.string(),
  content: z.array(z.string()),
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
});

export const blogPostsSchema = z.array(blogPostSchema);

export type BlogSection = z.infer<typeof blogSectionSchema>;
export type BlogPost = z.infer<typeof blogPostSchema>;
export type BlogCategory = z.infer<typeof blogCategorySchema>;
export type BlogRelatedProductCategory = z.infer<
  typeof blogRelatedProductCategorySchema
>;
