import { FeaturedProductsSection } from "@/components/featured-products-section";
import { HomeTrustSection } from "@/components/home-trust-section";
import { HomeCategoryLinks } from "@/components/home-category-links";
import { HeroSection } from "@/components/hero-section";
import { LatestBlogSection } from "@/components/latest-blog-section";
import { TestimonialsSection } from "@/components/testimonials-section";
import { getAllBlogPosts } from "@/lib/blog";
import { homePageMetadata } from "@/lib/commercial-seo";
import { homeShoppingFaqs } from "@/lib/home-trust-content";
import { faqPageJsonLd } from "@/lib/json-ld";
import { products } from "@/lib/products";

export const metadata = homePageMetadata;

// Five-minute ISR keeps the latest-blog rail fresh as new posts are
// published through the hybrid read path, without paying for SSR on
// every public visit.
export const revalidate = 300;

export default async function Home() {
  const allPosts = await getAllBlogPosts();
  const latestPosts = [...allPosts]
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, 3);

  const homeFaqStructuredData = faqPageJsonLd([...homeShoppingFaqs]);

  return (
    <main className="min-h-screen bg-[#F9F5F1]">
      <HeroSection />
      <HomeCategoryLinks products={products} />
      <FeaturedProductsSection />
      <LatestBlogSection posts={latestPosts} />
      <TestimonialsSection />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(homeFaqStructuredData),
        }}
      />
      <HomeTrustSection faqs={homeShoppingFaqs} />
    </main>
  );
}
