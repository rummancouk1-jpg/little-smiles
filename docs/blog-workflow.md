# Blog Workflow

Use this guide to add new SEO blog posts quickly in a consistent format.

## Where blogs are stored

- Post data lives in `lib/blog.ts`
- Blog list page is `app/blog/page.tsx`
- Blog detail page template is `app/blog/[slug]/page.tsx`

You only need to edit `lib/blog.ts` for normal publishing.

## How to add a new blog post

1. Open `lib/blog.ts`.
2. Copy one existing object from `blogPosts`.
3. Paste it at the end of the array.
4. Update these required fields:
   - `slug` (lowercase, hyphen-separated, unique)
   - `title`
   - `description` (clear summary for search snippet)
   - `category` (`Newborn Care` or `Buying Guide` or `Feeding`)
   - `relatedProductCategory` (must match a real product category)
   - `publishedAt` (format: `YYYY-MM-DD`)
   - `readTime` (example: `5 min read`)
   - `keywords` (3-6 search phrases)
   - `sections` (at least 3 sections)
   - `cta` (`label` + `href` to relevant shop category)
5. Save file.

The post will automatically:
- appear on `/blog`
- get its own page at `/blog/[slug]`
- appear in sitemap output
- show related articles and related products

## Slug best practices

- Good: `best-swaddle-for-summer-pakistan`
- Avoid:
  - spaces
  - uppercase letters
  - dates at the start
  - duplicate slugs

## Content structure that converts

Use this simple structure:

- Section 1: problem/context
- Section 2: actionable checklist or comparison
- Section 3: clear recommendation
- Final CTA: link to one relevant shop category

Keep paragraphs short (2-4 lines) and practical.

## SEO checklist before publish

- Title includes one primary keyword.
- Description is clear and intent-focused.
- Keywords are relevant and non-spammy.
- Content answers one parent question deeply.
- CTA points to the most relevant category URL.

## Optional quality pass

- Read once on mobile layout.
- Verify tone is helpful and premium.
- Ensure no repeated wording from another post.
