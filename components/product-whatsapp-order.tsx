"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AddToCartButton } from "@/components/add-to-cart-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trackAndOpenWhatsapp } from "@/lib/order-intent-client";
import {
  type Product,
  clampOrderQuantity,
  formatPkr,
  getAvailabilityLabel,
  getDiscountBadgeLabel,
  getWhatsappOrderLink,
  productShowsSizeField,
  productShowsVariantField,
} from "@/lib/products";

type ProductWhatsappOrderProps = {
  product: Product;
};

export function ProductWhatsappOrder({ product }: ProductWhatsappOrderProps) {
  const maxQty = Math.max(1, product.inventoryQty);
  const [quantity, setQuantity] = useState(1);
  const [variantNote, setVariantNote] = useState("");
  const [sizeNote, setSizeNote] = useState("");
  const [customerNote, setCustomerNote] = useState("");

  useEffect(() => {
    setQuantity((previous) => clampOrderQuantity(product, previous));
  }, [product]);

  const safeQty = clampOrderQuantity(product, quantity);

  const orderHref = useMemo(
    () =>
      getWhatsappOrderLink(product, {
        quantity: safeQty,
        variantNote: variantNote.trim() || undefined,
        sizeNote: sizeNote.trim() || undefined,
        customerNote: customerNote.trim() || undefined,
      }),
    [product, safeQty, variantNote, sizeNote, customerNote],
  );

  const lineTotal = product.pricePkr * safeQty;

  const variantPlaceholder =
    product.category === "Bodysuits"
      ? "Which print, or color"
      : product.category === "Food Container"
        ? "Which design"
        : "Color, print, or style";

  const disabled = !product.inStock;

  return (
    <>
      <div className="self-center lg:pr-6">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-ink-base/52">
          Little Smiles
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className="border-ink-base/12 bg-white/65 text-ink-base/74"
          >
            {product.category}
          </Badge>
          {getDiscountBadgeLabel(product) ? (
            <Badge className="border-transparent bg-ink-walnut text-ink-foreground">
              {getDiscountBadgeLabel(product)}
            </Badge>
          ) : null}
        </div>
        <h1
          id="product-title"
          className="mt-4 text-3xl font-semibold tracking-tight text-ink-espresso sm:mt-5 sm:text-5xl"
        >
          {product.name}
        </h1>
        <p className="mt-5 max-w-[42ch] text-base leading-relaxed text-ink-base/72 sm:text-lg">
          {product.longDescription}
        </p>

        <div className="mt-7 rounded-2xl border border-ink-base/10 bg-white/58 p-4 sm:p-5">
          <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
            <p className="text-3xl font-semibold text-ink-walnut sm:text-[2rem]">
              {formatPkr(product.pricePkr)}
            </p>
            {getDiscountBadgeLabel(product) ? (
              <p className="text-base text-ink-base/56 line-through">
                {formatPkr(product.compareAtPricePkr)}
              </p>
            ) : null}
          </div>
          <p className="mt-2 text-xs font-semibold tracking-[0.1em] text-tone-availability uppercase">
            {getAvailabilityLabel(product)}
          </p>
        </div>

        <div className="mt-8 space-y-4 rounded-2xl border border-ink-base/10 bg-white/55 p-4 sm:p-5">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-ink-base/55">
            Add your details
          </p>

          <div className="grid gap-2">
            <label className="text-sm font-medium text-ink-walnut" htmlFor="order-qty">
              Quantity
            </label>
            <select
              id="order-qty"
              className="h-11 w-full max-w-[12rem] rounded-full border border-ink-base/14 bg-white/90 px-4 text-sm text-ink-walnut outline-none focus-visible:ring-2 focus-visible:ring-ink-base/25"
              value={safeQty}
              disabled={disabled}
              onChange={(event) =>
                setQuantity(Number.parseInt(event.target.value, 10) || 1)
              }
            >
              {Array.from({ length: maxQty }, (_, index) => index + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                  {maxQty === 1 ? " (only one available)" : ""}
                </option>
              ))}
            </select>
          </div>

          {productShowsVariantField(product) ? (
            <div className="grid gap-2">
              <label className="text-sm font-medium text-ink-walnut" htmlFor="order-variant">
                Color or style
              </label>
              <Input
                id="order-variant"
                placeholder={variantPlaceholder}
                value={variantNote}
                disabled={disabled}
                onChange={(event) => setVariantNote(event.target.value)}
                className="h-11 rounded-full border-ink-base/14 bg-white/90 px-4 text-base lg:text-sm"
              />
              <p className="text-xs text-ink-base/58">
                Optional. We confirm before packing.
              </p>
            </div>
          ) : null}

          {productShowsSizeField(product) ? (
            <div className="grid gap-2">
              <label className="text-sm font-medium text-ink-walnut" htmlFor="order-size">
                Size
              </label>
              <Input
                id="order-size"
                placeholder="Newborn, 0–3 months — we'll confirm"
                value={sizeNote}
                disabled={disabled}
                onChange={(event) => setSizeNote(event.target.value)}
                className="h-11 rounded-full border-ink-base/14 bg-white/90 px-4 text-base lg:text-sm"
              />
            </div>
          ) : null}

          <div className="grid gap-2">
            <label className="text-sm font-medium text-ink-walnut" htmlFor="order-note">
              Note (optional)
            </label>
            <textarea
              id="order-note"
              placeholder="Gift note, delivery timing, or anything else"
              value={customerNote}
              disabled={disabled}
              onChange={(event) => setCustomerNote(event.target.value)}
              className="min-h-22 w-full rounded-2xl border border-ink-base/14 bg-white/90 px-4 py-2.5 text-sm text-ink-walnut outline-none focus-visible:ring-2 focus-visible:ring-ink-base/25"
            />
          </div>

          <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-ink-base/10 pt-4">
            <span className="text-sm text-ink-base/72">
              {safeQty > 1 ? "Line total" : "Total"}
            </span>
            <span className="text-lg font-semibold text-ink-walnut">
              {formatPkr(lineTotal)}
            </span>
          </div>
        </div>

        <div className="mt-7 rounded-2xl border border-ink-base/10 bg-surface-panel/88 p-4 text-sm leading-relaxed text-ink-base/76">
          <p>
            <span className="font-semibold text-ink-espresso">Payment:</span> Cash on delivery, available across Pakistan.
          </p>
          <p>
            <span className="font-semibold text-ink-espresso">Shipping:</span> {product.dispatchTimeline}{" "}
            {product.deliveryEstimate}
          </p>
          <p className="mt-2">
            <span className="font-semibold text-ink-espresso">Care:</span> {product.careNote}
          </p>
          <p className="mt-2">
            <span className="font-semibold text-ink-espresso">Gifting:</span> {product.giftingNote}
          </p>
          <p className="mt-2">
            <span className="font-semibold text-ink-espresso">Returns:</span> Message us within 48 hours of delivery for damaged or wrong items, with photos.
          </p>
          <p className="mt-3 text-xs text-ink-base/68">
            Already placed an order?{" "}
            <Link href="/track-order" className="font-medium text-ink-walnut underline underline-offset-2 hover:text-ink-espresso">
              Track your order
            </Link>
            .
          </p>
        </div>

        <div className="mt-7 flex flex-col gap-3 sm:mt-9 sm:flex-row sm:flex-wrap sm:items-center">
          {disabled ? (
            <Button
              disabled
              className="h-11 w-full rounded-full bg-ink-base/35 px-7 text-sm font-medium text-ink-foreground sm:w-auto"
              type="button"
            >
              Currently unavailable
            </Button>
          ) : (
            <>
              <AddToCartButton product={product} quantity={safeQty} className="w-full sm:w-auto" />
              <Button
                asChild
                variant="outline"
                className="h-12 w-full rounded-full border-ink-walnut/16 bg-white/72 px-7 text-sm font-semibold text-ink-walnut sm:h-11 sm:w-auto"
              >
                <Link
                  href={orderHref}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(event) =>
                    void trackAndOpenWhatsapp(event, {
                      whatsappUrl: orderHref,
                      sourcePage: "product_detail",
                      productSlug: product.slug,
                      productName: product.name,
                      category: product.category,
                      pricePkr: product.pricePkr,
                    })
                  }
                >
                  Order on WhatsApp
                </Link>
              </Button>
            </>
          )}
          <Link
            href="/shop"
            className="group inline-flex h-11 items-center gap-1.5 self-center text-sm font-medium text-ink-base/72 underline decoration-ink-base/20 underline-offset-[6px] transition-[color,text-decoration-color] duration-200 hover:text-ink-espresso hover:decoration-ink-espresso/45 sm:self-auto"
          >
            <span
              aria-hidden
              className="text-[0.95em] leading-none transition-transform duration-200 group-hover:-translate-x-0.5"
            >
              ←
            </span>
            Back to shop
          </Link>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-2 sm:hidden">
        <div className="mx-auto max-w-md space-y-2 rounded-2xl border border-ink-base/12 bg-surface-card/96 p-3 shadow-[0_18px_38px_-24px_rgba(59,47,47,0.45)] backdrop-blur-md supports-[backdrop-filter]:bg-surface-card/92">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-base font-semibold text-ink-walnut">{formatPkr(lineTotal)}</p>
            {safeQty === 1 && getDiscountBadgeLabel(product) ? (
              <p className="text-[11px] text-ink-base/58 line-through">
                {formatPkr(product.compareAtPricePkr)}
              </p>
            ) : (
              <p className="text-[11px] text-ink-base/58">
                {safeQty} × {formatPkr(product.pricePkr)} each
              </p>
            )}
          </div>
          {disabled ? (
            <Button
              disabled
              className="h-11 w-full rounded-full bg-ink-base/35 text-xs font-medium text-ink-foreground"
              type="button"
            >
              Unavailable
            </Button>
          ) : (
            <div className="flex gap-2">
              <AddToCartButton
                product={product}
                quantity={safeQty}
                label="Add to cart"
                className="h-11 min-h-11 flex-1 text-xs"
              />
              <Button
                asChild
                variant="outline"
                className="h-11 min-h-11 shrink-0 rounded-full border-ink-walnut/16 bg-white/72 px-3 text-xs font-semibold text-ink-walnut"
              >
                <Link
                  href={orderHref}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(event) =>
                    void trackAndOpenWhatsapp(event, {
                      whatsappUrl: orderHref,
                      sourcePage: "product_detail_sticky",
                      productSlug: product.slug,
                      productName: product.name,
                      category: product.category,
                      pricePkr: product.pricePkr,
                    })
                  }
                >
                  WhatsApp
                </Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
