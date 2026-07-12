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
  /**
   * Paragraphs. A tiny markdown subset is supported for INTERNAL links
   * only: `[anchor text](/shop/slug)`, `[…](/blog/slug)`, or
   * `[…](/shop?category=…)`. The renderer turns internal hrefs into real
   * anchors; anything else stays plain text.
   */
  content: z.array(z.string()),
});

export const blogFaqItemSchema = z.object({
  question: z.string(),
  answer: z.string(),
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
  /**
   * Optional reviewer-selected hero image path under /public (e.g.
   * "/products/foo.jpg"). When absent, the on-page hero and BlogPosting
   * JSON-LD fall back to getBlogAnchorProduct(post).image. Backwards-
   * compatible: existing posts in lib/blog.ts omit this field and keep
   * the old auto-resolved behaviour.
   */
  heroImage: z.string().optional(),
  /**
   * Optional FAQ entries (3-5 recommended). Rendered as a styled FAQ
   * section and emitted as FAQPage JSON-LD — the People Also Ask lever.
   */
  faq: z.array(blogFaqItemSchema).optional(),
});

export const blogPostsSchema = z.array(blogPostSchema);

export type BlogSection = z.infer<typeof blogSectionSchema>;
export type BlogFaqItem = z.infer<typeof blogFaqItemSchema>;
export type BlogPost = z.infer<typeof blogPostSchema>;
export type BlogCategory = z.infer<typeof blogCategorySchema>;
export type BlogRelatedProductCategory = z.infer<
  typeof blogRelatedProductCategorySchema
>;
