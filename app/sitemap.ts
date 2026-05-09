import type { MetadataRoute } from "next";

import { blogPosts } from "@/lib/blog";
import { products } from "@/lib/products";
import { siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
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

  const productEntries = products.map((product) => ({
    url: `${baseUrl}/shop/${product.slug}`,
    lastModified: buildDate,
    changeFrequency: "weekly" as const,
    priority: 0.82,
  }));

  const blogEntries = blogPosts.map((post) => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: new Date(post.publishedAt),
    changeFrequency: "monthly" as const,
    priority: 0.74,
  }));

  return [...staticEntries, ...productEntries, ...blogEntries];
}
