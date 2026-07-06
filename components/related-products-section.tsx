"use client";

import Link from "next/link";

import { AddToCartButton } from "@/components/add-to-cart-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trackAndOpenWhatsapp } from "@/lib/order-intent-client";
import {
  type Product,
  formatPkr,
  getAvailabilityLabel,
  getDiscountBadgeLabel,
  getImageCandidates,
  getWhatsappOrderLink,
} from "@/lib/products";
import { ProductImage } from "@/components/product-image";

type RelatedProductsSectionProps = {
  products: Product[];
};

export function RelatedProductsSection({ products }: RelatedProductsSectionProps) {
  if (products.length === 0) return null;

  return (
    <section className="mt-14 sm:mt-16" aria-labelledby="related-products-title">
      <div className="mb-6 flex items-center justify-between gap-3">
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {products.map((item) => (
          <article
            key={item.slug}
            className="rounded-3xl border border-ink-base/10 bg-surface-card/94 p-3.5 shadow-[0_22px_46px_-30px_rgba(59,47,47,0.32)]"
          >
            <Link href={`/shop/${item.slug}`} className="group block">
              <div className="relative h-44 rounded-2xl bg-surface-well p-4">
                <ProductImage
                  sources={getImageCandidates(item.image)}
                  alt={`${item.name} by Little Smiles`}
                  fill
                  sizes="(max-width: 1024px) 50vw, 25vw"
                  className="object-contain object-center"
                />
              </div>
              <p className="mt-3 text-sm font-semibold text-ink-walnut group-hover:underline">
                {item.name}
              </p>
            </Link>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-ink-base/12 bg-surface-raised/66 text-ink-base/74">
                {item.category}
              </Badge>
              {getDiscountBadgeLabel(item) ? (
                <Badge className="border-transparent bg-ink-walnut text-ink-foreground">
                  {getDiscountBadgeLabel(item)}
                </Badge>
              ) : null}
            </div>
            <div className="mt-2">
              <p className="text-base font-semibold text-ink-walnut">{formatPkr(item.pricePkr)}</p>
              <p className="text-[11px] font-medium tracking-[0.08em] text-tone-availability uppercase">
                {getAvailabilityLabel(item)}
              </p>
            </div>
            <div className="mt-3 flex flex-col gap-2">
              <AddToCartButton product={item} size="sm" className="h-10 w-full text-xs" />
              <Button
                asChild
                variant="outline"
                className="h-9 w-full rounded-full border-ink-walnut/14 bg-surface-raised/62 text-xs font-medium text-ink-walnut"
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
