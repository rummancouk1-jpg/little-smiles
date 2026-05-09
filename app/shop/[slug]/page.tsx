import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProductWhatsappOrder } from "@/components/product-whatsapp-order";
import { RelatedProductsSection } from "@/components/related-products-section";
import { ProductImage } from "@/components/product-image";
import { getProductDetailMetadata } from "@/lib/commercial-seo";
import { breadcrumbJsonLdDocument, productJsonLd } from "@/lib/json-ld";
import {
  getImageCandidates,
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
    <main className="relative min-h-screen overflow-hidden bg-[#F9F5F1] pt-10 pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] max-sm:pb-[calc(7.25rem+env(safe-area-inset-bottom,0px))] sm:pt-12 lg:pt-16">
      <div className="pointer-events-none absolute inset-0 opacity-[0.46]" aria-hidden>
        <div className="absolute -left-32 top-4 h-[420px] w-[420px] rounded-full bg-[#F0E8E1]/70 blur-3xl" />
        <div className="absolute -right-32 top-24 h-[420px] w-[420px] rounded-full bg-[#ECE4DD]/62 blur-3xl" />
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
          <div className="relative rounded-3xl border border-[#3B2F2F]/10 bg-[#FBF7F3]/95 p-5 shadow-[0_30px_62px_-36px_rgba(59,47,47,0.38)] sm:p-7">
            <div className="pointer-events-none absolute -left-6 -top-6 h-24 w-24 rounded-full bg-[#EEE5DE]/82 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-6 -right-8 h-28 w-28 rounded-full bg-[#E9E1D9]/70 blur-2xl" />
            <div className="relative h-[320px] rounded-3xl bg-[#F5EEE7] p-6 sm:h-[460px] sm:p-7">
              <ProductImage
                sources={getImageCandidates(product.image)}
                alt={`${product.name} — ${product.category} by Little Smiles Pakistan`}
                fill
                className="object-contain object-center"
                sizes="(max-width: 1024px) 100vw, 50vw"
                priority
              />
            </div>
          </div>

          <ProductWhatsappOrder product={product} />
        </article>
        <RelatedProductsSection products={relatedProducts} />
      </section>
    </main>
  );
}
