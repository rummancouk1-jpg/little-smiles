import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductImage } from "@/components/product-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  formatPkr,
  getImageCandidates,
  getProductBySlug,
  getWhatsappOrderLink,
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
      title: "Product not found | Little Smiles",
    };
  }

  return {
    title: `${product.name} | Little Smiles`,
    description: product.description,
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = getProductBySlug(slug);

  if (!product) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    image: [`https://www.littlesmiles.co${product.image}`],
    description: product.description,
    brand: {
      "@type": "Brand",
      name: "Little Smiles",
    },
    offers: {
      "@type": "Offer",
      priceCurrency: "PKR",
      price: product.pricePkr,
      availability: "https://schema.org/InStock",
      url: `https://www.littlesmiles.co/shop/${product.slug}`,
    },
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#F9F5F1] pb-18 pt-10 sm:pt-12 lg:pt-16">
      <div className="pointer-events-none absolute inset-0 opacity-[0.46]" aria-hidden>
        <div className="absolute -left-32 top-4 h-[420px] w-[420px] rounded-full bg-[#F0E8E1]/70 blur-3xl" />
        <div className="absolute -right-32 top-24 h-[420px] w-[420px] rounded-full bg-[#ECE4DD]/62 blur-3xl" />
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <section className="relative mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <div className="grid items-start gap-8 lg:grid-cols-2 lg:gap-16">
          <div className="relative rounded-3xl border border-[#3B2F2F]/10 bg-[#FBF7F3]/95 p-5 shadow-[0_30px_62px_-36px_rgba(59,47,47,0.38)] sm:p-7">
            <div className="pointer-events-none absolute -left-6 -top-6 h-24 w-24 rounded-full bg-[#EEE5DE]/82 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-6 -right-8 h-28 w-28 rounded-full bg-[#E9E1D9]/70 blur-2xl" />
            <div className="relative h-[320px] rounded-3xl bg-[#F5EEE7] p-6 sm:h-[460px] sm:p-7">
              <ProductImage
                sources={getImageCandidates(product.image)}
                alt={product.name}
                fill
                className="object-contain object-center"
                sizes="(max-width: 1024px) 100vw, 50vw"
                priority
              />
            </div>
          </div>

          <div className="self-center lg:pr-6">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-[#3B2F2F]/52">
              Little Smiles
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="border-[#3B2F2F]/12 bg-white/65 text-[#3B2F2F]/74"
              >
                {product.category}
              </Badge>
              <Badge className="border-transparent bg-[#2F2624] text-[#F6F1EC]">
                {product.discountPercent}% OFF
              </Badge>
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[#1F1918] sm:mt-5 sm:text-5xl">
              {product.name}
            </h1>
            <p className="mt-6 max-w-[42ch] text-lg leading-relaxed text-[#3B2F2F]/72">
              {product.description}
            </p>

            <div className="mt-8 flex flex-wrap items-end gap-x-3 gap-y-1">
              <p className="text-2xl font-semibold text-[#2E2323]">
                {formatPkr(product.pricePkr)}
              </p>
              <p className="text-base text-[#3B2F2F]/56 line-through">
                {formatPkr(product.compareAtPricePkr)}
              </p>
            </div>
            <p className="mt-2 text-xs font-semibold tracking-[0.1em] text-[#6E2D2D] uppercase">
              {product.inStock ? `Only ${product.inventoryQty} left` : "Out of stock"}
            </p>

            <ul className="mt-6 flex flex-wrap gap-2.5 text-sm text-[#3B2F2F]/76">
              <li className="rounded-full border border-[#3B2F2F]/12 bg-white/55 px-3.5 py-1.5">
                Fabric: Skin-friendly
              </li>
              <li className="rounded-full border border-[#3B2F2F]/12 bg-white/55 px-3.5 py-1.5">
                Use: Daily essential
              </li>
              <li className="rounded-full border border-[#3B2F2F]/12 bg-white/55 px-3.5 py-1.5">
                Delivery: Pakistan-wide
              </li>
            </ul>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                asChild
                className="h-11 w-full rounded-full bg-[#2F2624] px-7 text-sm font-medium text-[#F6F1EC] shadow-[0_14px_32px_-20px_rgba(47,38,36,0.58)] transition-[transform,box-shadow,background-color] duration-300 hover:-translate-y-0.5 hover:bg-[#251E1D] hover:shadow-[0_18px_36px_-22px_rgba(47,38,36,0.66)] sm:w-auto"
              >
                <Link
                  href={getWhatsappOrderLink(product)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Order on WhatsApp
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-11 w-full rounded-full border-[#2E2323]/16 bg-white/62 px-7 text-sm font-medium text-[#2E2323] hover:bg-white/84 sm:w-auto"
              >
                <Link href="/shop">Back to Shop</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
      <div className="fixed inset-x-0 bottom-3 z-40 px-4 sm:hidden">
        <div className="mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl border border-[#3B2F2F]/12 bg-[#FCF8F4]/96 p-3 shadow-[0_18px_38px_-24px_rgba(59,47,47,0.45)] backdrop-blur-md">
          <div>
            <p className="text-sm font-semibold text-[#2E2323]">
              {formatPkr(product.pricePkr)}
            </p>
            <p className="text-[11px] text-[#3B2F2F]/58 line-through">
              {formatPkr(product.compareAtPricePkr)}
            </p>
          </div>
          <Button
            asChild
            className="h-10 rounded-full bg-[#2F2624] px-4 text-xs font-medium text-[#F6F1EC]"
          >
            <Link href={getWhatsappOrderLink(product)} target="_blank" rel="noreferrer">
              Order on WhatsApp
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
