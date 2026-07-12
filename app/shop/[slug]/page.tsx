import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProductWhatsappOrder } from "@/components/product-whatsapp-order";
import { RelatedProductsSection } from "@/components/related-products-section";
import { ProductGallery } from "@/components/product-gallery";
import { getProductDetailMetadata } from "@/lib/commercial-seo";
import { breadcrumbJsonLdDocument, productJsonLd } from "@/lib/json-ld";
import {
  getProductBySlug,
  getRelatedProducts,
  products,
} from "@/lib/products";

type ProductPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  return products.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = getProductBySlug(slug);

  if (!product) {
    return {
      title: "Not found",
      robots: { index: false, follow: true },
    };
  }

  return getProductDetailMetadata(product);
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = getProductBySlug(slug);

  if (!product) notFound();

  const jsonLd = productJsonLd(product);
  const breadcrumbLd = breadcrumbJsonLdDocument([
    { name: "Home", path: "/" },
    { name: "Shop", path: "/shop" },
    { name: product.name, path: `/shop/${product.slug}` },
  ]);
  const relatedProducts = getRelatedProducts(product, 4);

  return (
    <main className="relative min-h-screen overflow-hidden bg-surface-page pt-10 pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] max-sm:pb-[calc(7.25rem+env(safe-area-inset-bottom,0px))] sm:pt-12 lg:pt-16">
      <div className="pointer-events-none absolute inset-0 opacity-[0.46]" aria-hidden>
        <div className="absolute -left-32 top-4 h-[420px] w-[420px] rounded-full bg-atmosphere-haze/70 blur-3xl" />
        <div className="absolute -right-32 top-24 h-[420px] w-[420px] rounded-full bg-atmosphere-haze/62 blur-3xl" />
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <section className="relative mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <article
          className="grid items-start gap-8 lg:grid-cols-2 lg:gap-16"
          aria-labelledby="product-title"
        >
          {/* No panel box — the arch window sits directly on the paper
              ground (Golden Hour "fewer boxes"). */}
          <div className="relative lg:sticky lg:top-24 lg:self-start">
            <ProductGallery product={product} />
          </div>

          <ProductWhatsappOrder product={product} />
        </article>
        <RelatedProductsSection products={relatedProducts} />
      </section>
      {/* End-of-content marker: the desktop buy-bar hides once this scrolls into
          view so the fixed bar never overlaps the footer. */}
      <div id="pdp-scroll-end" aria-hidden className="h-px w-full" />
    </main>
  );
}
