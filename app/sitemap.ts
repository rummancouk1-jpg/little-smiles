import type { MetadataRoute } from "next";

import { getBlogAnchorProduct } from "@/lib/blog";
import { getAllBlogPosts } from "@/lib/blog-data";
import { products } from "@/lib/products";
import { absoluteUrl, siteUrl } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static seed posts + admin-published Supabase posts — a publish lands
  // in the sitemap without a deploy (publish route revalidates this file).
  const blogPosts = await getAllBlogPosts();
  const baseUrl = siteUrl;
  const staticRoutes = [
    "",
    "/shop",
    "/blog",
    "/best-sellers",
    "/reviews",
    "/contact",
    "/track-order",
    "/shipping-policy",
    "/return-refund-policy",
    "/privacy-policy",
    "/terms",
  ];

  const staticPriorities: Record<string, number> = {
    "": 1,
    "/shop": 0.95,
    "/blog": 0.85,
    "/best-sellers": 0.88,
    "/reviews": 0.78,
    "/contact": 0.75,
    "/track-order": 0.52,
    "/shipping-policy": 0.35,
    "/return-refund-policy": 0.35,
    "/privacy-policy": 0.35,
    "/terms": 0.35,
  };

  const buildDate = new Date(process.env.VERCEL_GIT_COMMIT_DATE ?? Date.now());
  const staticEntries = staticRoutes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: buildDate,
    changeFrequency: "weekly" as const,
    priority: staticPriorities[route] ?? 0.65,
  }));

  // Product entries advertise their hero image so Google + Pinterest can
  // discover and index it. Image URL must be absolute per the sitemap spec.
  const productEntries = products.map((product) => ({
    url: `${baseUrl}/shop/${product.slug}`,
    lastModified: buildDate,
    changeFrequency: "weekly" as const,
    priority: 0.82,
    images: [absoluteUrl(product.image)],
  }));

  // Blog entries reuse the same anchor-product image the article renders
  // and JSON-LD already declares — keeps SERP / Pinterest previews aligned
  // with what the visitor will actually see on-page.
  const blogEntries = blogPosts.map((post) => {
    const anchor = getBlogAnchorProduct(post);
    const entry: MetadataRoute.Sitemap[number] = {
      url: `${baseUrl}/blog/${post.slug}`,
      lastModified: new Date(post.publishedAt),
      changeFrequency: "monthly" as const,
      priority: 0.74,
    };
    if (anchor) {
      entry.images = [absoluteUrl(anchor.image)];
    }
    return entry;
  });

  return [...staticEntries, ...productEntries, ...blogEntries];
}
