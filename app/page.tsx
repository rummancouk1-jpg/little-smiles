import { FeaturedProductsSection } from "@/components/featured-products-section";
import { HomeCategoryLinks } from "@/components/home-category-links";
import { HeroSection } from "@/components/hero-section";
import { LatestBlogSection } from "@/components/latest-blog-section";
import { TestimonialsSection } from "@/components/testimonials-section";
import { blogPosts } from "@/lib/blog";
import { products } from "@/lib/products";

export default function Home() {
  const latestPosts = [...blogPosts]
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, 3);

  return (
    <main className="min-h-screen bg-[#F9F5F1]">
      <HeroSection />
      <HomeCategoryLinks products={products} />
      <FeaturedProductsSection />
      <LatestBlogSection posts={latestPosts} />
      <TestimonialsSection />
    </main>
  );
}
