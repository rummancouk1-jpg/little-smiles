import { products, type Product } from "@/lib/products";
import {
  blogPostSchema,
  blogPostsSchema,
  type BlogPost,
  type BlogSection,
} from "@/lib/contentops/blog-schema";
import { listDrafts } from "@/lib/contentops/drafts-store";

export type { BlogPost, BlogSection };

const rawBlogPosts: BlogPost[] = [
  {
    slug: "newborn-essentials-checklist-pakistan-2026",
    title: "Newborn Essentials Checklist in Pakistan (2026): What You Actually Need",
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

/**
 * Static seed of blog posts. Authored in code, validated at module load.
 * Remains canonical for every post that exists here — Supabase-sourced
 * posts are purely additive (see getAllBlogPosts below).
 */
export const blogPosts: BlogPost[] = blogPostsSchema.parse(rawBlogPosts);

/**
 * Synchronous lookup against the static seed only. Used by:
 *   - lib/blog-publish-adapter.ts: operator pre-flight duplicate check
 *     against the static archive
 *   - lib/json-ld.ts: structured-data helpers that don't need DB
 * Public render surfaces should use getBlogPostBySlugAsync instead.
 */
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

// ---------------------------------------------------------------------------
// Hybrid additive read path (Commit K)
//
// All public render surfaces (home, blog list, blog detail, sitemap) read
// through these async helpers. They return the static seed merged with
// Supabase drafts in status='published'. Static slugs win on conflict.
//
// Failure-safe by design:
//   - Supabase outage / network failure -> return only the static seed.
//   - Per-row schema mismatch -> skip that row, do not throw.
//   - No Supabase env vars configured -> listDrafts throws inside
//     requireClient; we catch and degrade.
//
// The static seed is therefore the safety floor. The blog never breaks
// because of a dynamic-layer failure.
// ---------------------------------------------------------------------------

function mergeStaticAndPublished(publishedDrafts: { slug: string; content: unknown }[]): BlogPost[] {
  const staticSlugs = new Set(blogPosts.map((post) => post.slug));
  const additive: BlogPost[] = [];
  for (const draft of publishedDrafts) {
    if (staticSlugs.has(draft.slug)) continue;
    const parsed = blogPostSchema.safeParse(draft.content);
    if (parsed.success) additive.push(parsed.data);
    // Silent skip on parse failure. listDrafts pre-validates by type
    // assertion; this is defense in depth for legacy / hand-inserted rows.
  }
  return [...blogPosts, ...additive];
}

/**
 * All publishable blog posts: static seed + Supabase published drafts.
 * Used by every public render surface.
 */
export async function getAllBlogPosts(): Promise<BlogPost[]> {
  try {
    const published = await listDrafts("published");
    return mergeStaticAndPublished(published);
  } catch {
    return blogPosts;
  }
}

/**
 * Slug lookup that consults the static seed first (cheap, no DB call),
 * then falls back to Supabase published drafts.
 */
export async function getBlogPostBySlugAsync(
  slug: string,
): Promise<BlogPost | undefined> {
  const staticHit = blogPosts.find((post) => post.slug === slug);
  if (staticHit) return staticHit;
  try {
    const published = await listDrafts("published");
    for (const draft of published) {
      if (draft.slug !== slug) continue;
      const parsed = blogPostSchema.safeParse(draft.content);
      return parsed.success ? parsed.data : undefined;
    }
  } catch {
    // Degrade silently to "not found" so the route renders notFound()
    // rather than 500ing on a dynamic-layer failure.
  }
  return undefined;
}
