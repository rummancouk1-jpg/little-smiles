"use client";

import Link from "next/link";
import { Reveal } from "@/components/reveal";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { trackAndOpenWhatsapp } from "@/lib/order-intent-client";
import {
  type Product,
  formatPkr,
  getAvailabilityLabel,
  getDiscountBadgeLabel,
  getImageCandidates,
  getWhatsappOrderLink,
} from "@/lib/products";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProductImage } from "@/components/product-image";
import { cn } from "@/lib/utils";

type ProductGridProps = {
  products: Product[];
  /**
   * Opt-in "keepsake" brass treatment for a single product by slug.
   * Only the card whose slug matches renders the featured tier; every other
   * card (and every grid that omits this prop) stays the standard tier.
   * Applying it to more products later = widen this to a slug set.
   */
  keepsakeSlug?: string;
};

export function ProductGrid({ products, keepsakeSlug }: ProductGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
      {products.map((product, index) => {
        const keepsake = product.slug === keepsakeSlug;
        return (
        <Reveal key={product.slug} index={index} className="h-full">
          <Card
            className={cn(
              "flex h-full overflow-hidden rounded-3xl bg-surface-card/94 py-0",
              keepsake
                ? "border-[1.5px] border-accent-brass"
                : "border border-ink-base/9",
              "shadow-card-rest transition-[transform,box-shadow] duration-300",
              "hover:-translate-y-1 hover:shadow-card-lift"
            )}
          >
            <CardContent className="p-0">
              <Link
                href={`/shop/${product.slug}`}
                className="group block rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-walnut/24"
              >
                <div className="relative mx-3.5 mt-3.5 h-52 rounded-3xl bg-surface-well p-4 sm:mx-4 sm:mt-4 sm:h-56 sm:p-5">
                  <div className="pointer-events-none absolute inset-0 rounded-3xl bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,255,255,0.5),transparent_65%)]" />
                  {keepsake ? (
                    <span className="absolute left-3 top-3 z-10 rounded-full bg-accent-brass px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent-brass-ink">
                      Bestseller
                    </span>
                  ) : null}
                  <ProductImage
                    sources={getImageCandidates(product.image)}
                    alt={`${product.name} — ${product.category} by Little Smiles`}
                    fill
                    className="object-contain object-center group-hover:scale-[1.015]"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                </div>
              </Link>
            </CardContent>
            <CardHeader className="px-4 pb-0 pt-4 sm:px-5 sm:pt-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className="w-fit border-ink-base/12 bg-surface-raised/66 text-ink-base/74"
                >
                  {product.category}
                </Badge>
                {getDiscountBadgeLabel(product) ? (
                  <Badge className="border-transparent bg-ink-walnut text-ink-foreground">
                    {getDiscountBadgeLabel(product)}
                  </Badge>
                ) : null}
              </div>
              <CardTitle className="pt-1.5 text-[1.24rem] font-semibold leading-[1.15] text-ink-espresso sm:text-[1.36rem] sm:leading-[1.1]">
                <Link
                  href={`/shop/${product.slug}`}
                  className="inline-flex min-h-11 items-center rounded-md hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-walnut/24"
                >
                  {product.name}
                </Link>
              </CardTitle>
              <p className="min-h-[2.8rem] pt-1 text-sm leading-relaxed text-ink-base/67 sm:min-h-[3.1rem] lg:min-h-[3.6rem]">
                {product.description}
              </p>
            </CardHeader>
            <CardFooter className="mt-auto flex flex-col items-stretch justify-between gap-3 border-ink-base/8 bg-transparent px-4 py-4 sm:flex-row sm:items-end sm:px-5">
              <div className="space-y-0.5">
                <div className="flex items-baseline gap-2.5">
                  <span className="text-lg font-semibold tabular-nums text-ink-strong sm:text-xl">
                    {formatPkr(product.pricePkr)}
                  </span>
                  {getDiscountBadgeLabel(product) ? (
                    <span className="text-sm tabular-nums text-ink-base/52 line-through">
                      {formatPkr(product.compareAtPricePkr)}
                    </span>
                  ) : null}
                </div>
                <p
                  className={cn(
                    "text-[11px] font-medium tracking-[0.08em] uppercase",
                    // Availability is per-state: trust green only when buyable.
                    product.inStock ? "text-tone-availability" : "text-tone-danger"
                  )}
                >
                  {getAvailabilityLabel(product)}
                </p>
              </div>
              <div className="flex w-full flex-col items-stretch gap-1.5 sm:w-auto sm:min-w-[11.5rem]">
                <AddToCartButton
                  product={product}
                  className={cn(
                    "w-full",
                    keepsake &&
                      "border-transparent bg-accent-brass text-accent-brass-ink hover:bg-accent-brass/90"
                  )}
                />
                <Link
                  href={getWhatsappOrderLink(product)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(event) =>
                    void trackAndOpenWhatsapp(event, {
                      whatsappUrl: getWhatsappOrderLink(product),
                      sourcePage: "product_grid",
                      productSlug: product.slug,
                      productName: product.name,
                      category: product.category,
                      pricePkr: product.pricePkr,
                    })
                  }
                  className="group inline-flex items-center justify-center gap-1.5 text-xs font-medium text-ink-muted underline decoration-ink-base/22 underline-offset-[5px] transition-[color,text-decoration-color] duration-200 hover:text-ink-strong hover:decoration-ink-espresso/45"
                >
                  Order on WhatsApp
                  <span
                    aria-hidden
                    className="text-[0.95em] leading-none transition-transform duration-200 group-hover:translate-x-0.5"
                  >
                    →
                  </span>
                </Link>
              </div>
            </CardFooter>
          </Card>
        </Reveal>
        );
      })}
    </div>
  );
}
