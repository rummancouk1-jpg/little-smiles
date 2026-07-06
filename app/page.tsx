import { FeaturedProductsSection } from "@/components/featured-products-section";
import { HomeTrustSection } from "@/components/home-trust-section";
import { HomeCategoryLinks } from "@/components/home-category-links";
import { HeroSection } from "@/components/hero-section";
import { HeroSpotlight } from "@/components/hero-spotlight";
import { LatestBlogSection } from "@/components/latest-blog-section";
import { TestimonialsSection } from "@/components/testimonials-section";
import { blogPosts } from "@/lib/blog";
import { homePageMetadata } from "@/lib/commercial-seo";
import { homeShoppingFaqs } from "@/lib/home-trust-content";
import { faqPageJsonLd } from "@/lib/json-ld";
import { products } from "@/lib/products";

export const metadata = homePageMetadata;

export default function Home() {
  const latestPosts = [...blogPosts]
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, 3);

  const homeFaqStructuredData = faqPageJsonLd([...homeShoppingFaqs]);

  return (
    <main className="min-h-screen bg-surface-page">
      {/* Hero is theme-split: airy light hero vs the dark Spotlight hero.
          Both render server-side; the .dark class (set pre-paint) picks one,
          so there's no flash and no hydration mismatch. */}
      <div className="dark:hidden">
        <HeroSection />
      </div>
      <div className="hidden dark:block">
        <HeroSpotlight />
      </div>
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
