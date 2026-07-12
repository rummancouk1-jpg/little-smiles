"use client";

import Link from "next/link";
import { Reveal } from "@/components/reveal";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { trackAndOpenWhatsapp } from "@/lib/order-intent-client";
import {
  type Product,
  formatPkr,
  getAvailabilityLabel,
  getImageCandidates,
  getWhatsappOrderLink,
  hasMeaningfulDiscount,
} from "@/lib/products";
import { ProductImage } from "@/components/product-image";
import { cn } from "@/lib/utils";

/**
 * Category -> nursery mat. Every arch window sits on a WARM mat from the
 * Golden Hour family; the mapping is deterministic so a category always
 * reads the same tint across the site. Exported for PDP/related reuse.
 */
export const categoryMatClass: Record<Product["category"], string> = {
  Swaddle: "bg-mat-peach",
  Bodysuits: "bg-mat-butter",
  "Food Bag": "bg-mat-sand",
  "Bottle Case": "bg-mat-sand",
  "Feeding Cushion": "bg-mat-blush",
  "Food Container": "bg-mat-sand",
  "Bow Set": "bg-mat-blush",
};

/** Calm availability dot — semantic color per state, never shouting caps. */
export function AvailabilityDot({
  product,
  className,
}: {
  product: Product;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "inline-flex items-center gap-1.5 text-xs text-ink-base/68",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-[7px] rounded-full",
          product.availabilityStatus === "out_of_stock"
            ? "bg-tone-danger"
            : product.availabilityStatus === "limited_stock"
              ? "bg-tone-amber"
              : "bg-tone-availability",
        )}
      />
      {getAvailabilityLabel(product)}
    </p>
  );
}

/** "You save Rs. X" fine print — replaces the % OFF badge + strikethrough. */
export function SavingsNote({
  product,
  className,
}: {
  product: Product;
  className?: string;
}) {
  if (!hasMeaningfulDiscount(product)) return null;
  return (
    <span className={cn("text-xs text-ink-base/56", className)}>
      you save {formatPkr(product.compareAtPricePkr - product.pricePkr)}
    </span>
  );
}

type ProductGridProps = {
  products: Product[];
  /**
   * Opt-in "keepsake" marigold Bestseller pill for a single product by slug.
   * Only the card whose slug matches renders the pill; every other card (and
   * every grid that omits this prop) stays the standard tier.
   */
  keepsakeSlug?: string;
};

export function ProductGrid({ products, keepsakeSlug }: ProductGridProps) {
  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product, index) => {
        const keepsake = product.slug === keepsakeSlug;
        return (
          <Reveal key={product.slug} index={index} className="h-full">
            {/* No card box — the arch window IS the object; text sits on the
                paper ground (Golden Hour "fewer boxes"). */}
            <article className="group flex h-full flex-col text-center">
              <Link
                href={`/shop/${product.slug}`}
                className="block rounded-t-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-walnut/30"
              >
                <div
                  className={cn(
                    "arch-frame pb-7 pt-9 shadow-card-rest transition-[transform,box-shadow] duration-300 group-hover:-translate-y-1 group-hover:shadow-card-lift",
                    categoryMatClass[product.category] ?? "bg-mat-butter",
                  )}
                >
                  {keepsake ? (
                    <span className="absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-full bg-accent-marigold px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent-marigold-ink">
                      Bestseller
                    </span>
                  ) : null}
                  <div className="relative mx-auto aspect-square w-[68%]">
                    <ProductImage
                      sources={getImageCandidates(product.image)}
                      alt={`${product.name} — ${product.category} by Little Smiles`}
                      fill
                      className="object-contain object-center transition-transform duration-300 group-hover:scale-[1.02]"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                  </div>
                  <div aria-hidden className="arch-floor bottom-[5%] h-3.5 w-[52%]" />
                </div>
              </Link>

              {/* Stitched ticket — category label seated on the arch rim. */}
              <span className="z-10 -mt-3.5 self-center rounded-full border border-dashed border-ink-base/30 bg-surface-raised px-3.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-base/70">
                {product.category}
              </span>

              <h3 className="mt-3.5 text-[1.35rem] font-semibold leading-[1.12] text-ink-strong">
                <Link
                  href={`/shop/${product.slug}`}
                  className="rounded-md hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-walnut/24"
                >
                  {product.name}
                </Link>
              </h3>

              <p className="mx-auto mt-1.5 line-clamp-2 max-w-[34ch] text-sm leading-relaxed text-ink-base/64">
                {product.description}
              </p>

              {/* Serif money — the price joins the display voice. */}
              <div className="mt-3 flex items-baseline justify-center gap-2.5">
                <span className="font-heading text-2xl font-semibold tabular-nums text-ink-strong">
                  {formatPkr(product.pricePkr)}
                </span>
                <SavingsNote product={product} />
              </div>
              <AvailabilityDot product={product} className="mt-1 justify-center" />

              <div className="mx-auto mt-auto flex w-full max-w-[16rem] flex-col items-stretch gap-2 pt-4">
                <AddToCartButton product={product} className="w-full" />
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
                  className="group/wa inline-flex min-h-9 items-center justify-center gap-1.5 text-xs font-medium text-ink-muted underline decoration-dashed decoration-ink-base/28 underline-offset-[5px] transition-[color,text-decoration-color] duration-200 hover:text-ink-strong hover:decoration-ink-espresso/45"
                >
                  or order on WhatsApp
                  <span
                    aria-hidden
                    className="text-[0.95em] leading-none transition-transform duration-200 group-hover/wa:translate-x-0.5"
                  >
                    →
                  </span>
                </Link>
              </div>
            </article>
          </Reveal>
        );
      })}
    </div>
  );
}
