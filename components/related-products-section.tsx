"use client";

import Link from "next/link";

import { AddToCartButton } from "@/components/add-to-cart-button";
import {
  AvailabilityDot,
  SavingsNote,
  categoryMatClass,
} from "@/components/product-grid";
import { Button } from "@/components/ui/button";
import { trackAndOpenWhatsapp } from "@/lib/order-intent-client";
import {
  type Product,
  formatPkr,
  getImageCandidates,
  getWhatsappOrderLink,
} from "@/lib/products";
import { ProductImage } from "@/components/product-image";
import { cn } from "@/lib/utils";

type RelatedProductsSectionProps = {
  products: Product[];
};

export function RelatedProductsSection({ products }: RelatedProductsSectionProps) {
  if (products.length === 0) return null;

  return (
    <section className="mt-14 sm:mt-16" aria-labelledby="related-products-title">
      <div className="mb-7 flex items-baseline justify-between gap-3">
        <h2
          id="related-products-title"
          className="text-2xl font-semibold tracking-tight text-ink-espresso sm:text-3xl"
        >
          Parents also liked
        </h2>
        <Link href="/shop" className="text-sm font-medium text-ink-walnut hover:underline">
          View all
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-4">
        {products.map((item) => (
          <article key={item.slug} className="group flex h-full flex-col text-center">
            <Link
              href={`/shop/${item.slug}`}
              className="block rounded-t-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-walnut/30"
            >
              {/* Compact arch window — same signature, quarter size. */}
              <div
                className={cn(
                  "arch-frame pb-5 pt-7 shadow-card-rest transition-[transform,box-shadow] duration-300 group-hover:-translate-y-1 group-hover:shadow-card-lift",
                  categoryMatClass[item.category] ?? "bg-mat-butter",
                )}
              >
                <div className="relative mx-auto aspect-square w-[70%]">
                  <ProductImage
                    sources={getImageCandidates(item.image)}
                    alt={`${item.name} by Little Smiles`}
                    fill
                    sizes="(max-width: 1024px) 50vw, 25vw"
                    className="object-contain object-center"
                  />
                </div>
                <div aria-hidden className="arch-floor bottom-[4%] h-2.5 w-[50%]" />
              </div>
              <p className="mt-3 text-sm font-semibold leading-snug text-ink-strong group-hover:underline">
                {item.name}
              </p>
            </Link>
            <div className="mt-1.5 flex flex-col items-center gap-0.5">
              <p className="font-heading text-lg font-semibold tabular-nums text-ink-strong">
                {formatPkr(item.pricePkr)}
              </p>
              <SavingsNote product={item} className="text-[11px]" />
              <AvailabilityDot product={item} className="text-[11px]" />
            </div>
            <div className="mt-auto flex flex-col gap-2 pt-3">
              <AddToCartButton product={item} size="sm" className="h-10 w-full text-xs" />
              <Button
                asChild
                variant="outline"
                className="h-9 w-full rounded-full border-dashed border-ink-base/35 bg-transparent text-xs font-medium text-ink-walnut shadow-none"
              >
                <Link
                  href={getWhatsappOrderLink(item)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(event) =>
                    void trackAndOpenWhatsapp(event, {
                      whatsappUrl: getWhatsappOrderLink(item),
                      sourcePage: "related_products",
                      productSlug: item.slug,
                      productName: item.name,
                      category: item.category,
                      pricePkr: item.pricePkr,
                    })
                  }
                >
                  WhatsApp instead
                </Link>
              </Button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
