import { products, type Product } from "@/lib/products";
import {
  blogPostsSchema,
  type BlogPost,
  type BlogSection,
} from "@/lib/contentops/blog-schema";

export type { BlogPost, BlogSection };

const rawBlogPosts: BlogPost[] = [
  {
    slug: "newborn-essentials-checklist-pakistan-2026",
    title: "Newborn Essentials Checklist Pakistan 2026: What You Actually Need",
    description:
      "A practical premium checklist for newborn shopping in Pakistan, so you buy smart and avoid unnecessary items.",
    category: "Newborn Care",
    relatedProductCategory: "Bodysuits",
    publishedAt: "2026-05-07",
    readTime: "6 min read",
    keywords: [
      "newborn essentials checklist pakistan",
      "baby products pakistan",
      "newborn shopping guide",
    ],
    sections: [
      {
        heading: "Start with comfort-first essentials",
        content: [
          "In the first few months, comfort and practicality matter more than buying too many items. A small, high-quality set of daily essentials is usually better than a large mixed bundle.",
          "Focus first on soft bodysuits, breathable swaddles, feeding support, and one reliable travel storage option. These are the products families use repeatedly.",
        ],
      },
      {
        heading: "The practical premium checklist",
        content: [
          "For clothing, keep 5 to 8 bodysuits and 2 to 3 swaddles in rotation. Prioritize breathable fabric, easy changes, and skin-friendly stitching.",
          "For feeding, include one feeding cushion for support and one insulated food or bottle carry item for outings. This reduces daily friction and helps routine consistency.",
          "For accessories, keep only what improves comfort and use. Avoid overbuying decorative items before core essentials are covered.",
        ],
      },
      {
        heading: "How to avoid overspending",
        content: [
          "Buy in phases. Week one should cover your immediate comfort and feeding needs. Add optional extras only after understanding what your baby uses most.",
          "When offers are live, prioritize categories with daily-use impact first. In most homes, that means bodysuits and swaddles before accessories.",
        ],
      },
    ],
    cta: {
      label: "Shop Newborn Essentials",
      href: "/shop?category=Bodysuits",
    },
  },
  {
    slug: "how-to-choose-the-best-swaddle-for-summer",
    title: "How to Choose the Best Swaddle for Summer: A Parent-Friendly Guide",
    description:
      "Choose the right summer swaddle with simple fabric, fit, and comfort checks that keep your baby cozy without overheating.",
    category: "Buying Guide",
    relatedProductCategory: "Swaddle",
    publishedAt: "2026-05-07",
    readTime: "5 min read",
    keywords: [
      "best swaddle for summer",
      "baby swaddle pakistan",
      "breathable swaddle guide",
    ],
    sections: [
      {
        heading: "Why summer swaddle choice matters",
        content: [
          "Summer comfort depends on breathable material and balanced wrapping. A heavy swaddle can make sleep uncomfortable, while the right fabric helps maintain calm rest.",
          "The best summer swaddles feel soft, airy, and secure without being bulky.",
        ],
      },
      {
        heading: "3 checks before you buy",
        content: [
          "Fabric check: choose lightweight and breathable material that feels gentle against skin.",
          "Fit check: swaddle should feel secure but not restrictive. Easy wrapping and easy unwrapping are both important for daily use.",
          "Routine check: pick patterns and quality that work for frequent use and repeated washing.",
        ],
      },
      {
        heading: "A simple summer rotation",
        content: [
          "For most families, two to three swaddles are enough for regular summer rotation. This keeps usage practical while ensuring clean backups are always available.",
          "If your baby sleeps in swaddles daily, add one extra high-use favorite.",
        ],
      },
    ],
    cta: {
      label: "Explore Swaddles",
      href: "/shop?category=Swaddle",
    },
  },
  {
    slug: "food-bag-vs-bottle-case-what-parents-need",
    title: "Food Bag vs Bottle Case: What Parents Actually Need for Daily Outings",
    description:
      "Understand when to choose a food bag, when to choose a bottle case, and when both make sense for smoother feeding travel.",
    category: "Feeding",
    relatedProductCategory: "Food Bag",
    publishedAt: "2026-05-07",
    readTime: "5 min read",
    keywords: [
      "food bag vs bottle case",
      "baby feeding travel pakistan",
      "insulated baby bag guide",
    ],
    sections: [
      {
        heading: "The core difference",
        content: [
          "A food bag is best for carrying multiple feeding essentials together in one place. A bottle case is best for focused bottle protection and temperature support.",
          "If your outings are longer or include multiple items, food bags are usually more practical.",
        ],
      },
      {
        heading: "Which one should you buy first",
        content: [
          "Start with the item that solves your biggest daily pain point. If organization is your issue, start with a food bag. If bottle safety and insulation are your issue, start with a bottle case.",
          "Many parents eventually keep one of each for flexibility across short and long trips.",
        ],
      },
      {
        heading: "Premium buying tips",
        content: [
          "Choose quality zips, easy-clean surfaces, and compact but structured designs. Better build quality matters more than decorative features.",
          "Look for products that feel reliable in daily handling rather than occasional use only.",
        ],
      },
    ],
    cta: {
      label: "Shop Feeding Essentials",
      href: "/shop?category=Food Bag",
    },
  },
];

export const blogPosts: BlogPost[] = blogPostsSchema.parse(rawBlogPosts);

export function getBlogPostBySlug(slug: string) {
  return blogPosts.find((post) => post.slug === slug);
}

/**
 * The product to use as the article's visual anchor — same image the
 * blog rail card shows, and the same image we surface in BlogPosting
 * structured data. Prefers featured + in-stock; falls back to any
 * in-category product, then null when the category has nothing.
 */
export function getBlogAnchorProduct(post: BlogPost): Product | null {
  const inCategory = products.filter(
    (product) => product.category === post.relatedProductCategory,
  );
  return (
    inCategory.find((product) => product.featured && product.inStock) ??
    inCategory.find((product) => product.inStock) ??
    inCategory[0] ??
    null
  );
}

/**
 * Single source of truth for "which image represents this post."
 * Prefers an explicit `post.heroImage` (typically chosen by a reviewer in
 * ContentOps) and falls back to the auto-resolved anchor product image
 * when no override is present.
 *
 * Used by:
 *   - JSON-LD BlogPosting.image (lib/json-ld.ts)
 *   - the public blog page hero (app/blog/[slug]/page.tsx)
 *   - the admin reviewer preview (components/contentops/website-preview.tsx)
 *
 * Returns `null` only when neither an override nor an in-category product
 * image exists. Callers must decide whether to fall through to a brand-level
 * default (e.g. defaultOgImagePath) — this helper stays project-data-only.
 */
export function resolveHeroImagePath(post: BlogPost): string | null {
  const explicit = post.heroImage?.trim();
  if (explicit && explicit.length > 0) return explicit;
  return getBlogAnchorProduct(post)?.image ?? null;
}
