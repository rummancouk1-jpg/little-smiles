import type { MetadataRoute } from "next";

import { blogPosts } from "@/lib/blog";
import { products } from "@/lib/products";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://www.littlesmiles.co";
  const staticRoutes = [
    "",
    "/shop",
    "/blog",
    "/best-sellers",
    "/reviews",
    "/contact",
    "/shipping-policy",
    "/return-refund-policy",
    "/privacy-policy",
    "/terms",
  ];

  const staticEntries = staticRoutes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: route === "" ? 1 : 0.7,
  }));

  const productEntries = products.map((product) => ({
    url: `${baseUrl}/shop/${product.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  const blogEntries = blogPosts.map((post) => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: new Date(post.publishedAt),
    changeFrequency: "monthly" as const,
    priority: 0.72,
  }));

  return [...staticEntries, ...productEntries, ...blogEntries];
}
