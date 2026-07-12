import { FeaturedProductsSection } from "@/components/featured-products-section";
import { HomeTrustSection } from "@/components/home-trust-section";
import { HomeCategoryLinks } from "@/components/home-category-links";
import { HeroSection } from "@/components/hero-section";
import { LatestBlogSection } from "@/components/latest-blog-section";
import { TestimonialsSection } from "@/components/testimonials-section";
import { getAllBlogPosts } from "@/lib/blog-data";
import { homePageMetadata } from "@/lib/commercial-seo";
import { homeShoppingFaqs } from "@/lib/home-trust-content";
import { faqPageJsonLd } from "@/lib/json-ld";
import { products } from "@/lib/products";

export const metadata = homePageMetadata;

/* ISR safety net — the publish action revalidates the home page so the
   latest-posts rail picks up new articles without a deploy. */
export const revalidate = 3600;

export default async function Home() {
  const latestPosts = (await getAllBlogPosts()).slice(0, 3);

  const homeFaqStructuredData = faqPageJsonLd([...homeShoppingFaqs]);

  return (
    <main className="min-h-screen bg-surface-page">
      {/* ONE hero for both themes (Golden Hour): the token spine inverts it —
          paper by day, nightlight nursery in dark. No theme split needed. */}
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
