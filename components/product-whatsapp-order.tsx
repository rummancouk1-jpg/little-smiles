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
      ? "Print / color preference (as shown)"
      : product.category === "Food Container"
        ? "Which design / option (reference listing)"
        : "Color, print, or style preference";

  const disabled = !product.inStock;

  return (
    <>
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
          {getDiscountBadgeLabel(product) ? (
            <Badge className="border-transparent bg-[#2F2624] text-[#F6F1EC]">
              {getDiscountBadgeLabel(product)}
            </Badge>
          ) : null}
        </div>
        <h1
          id="product-title"
          className="mt-4 text-3xl font-semibold tracking-tight text-[#1F1918] sm:mt-5 sm:text-5xl"
        >
          {product.name}
        </h1>
        <p className="mt-5 max-w-[42ch] text-base leading-relaxed text-[#3B2F2F]/72 sm:text-lg">
          {product.longDescription}
        </p>

        <div className="mt-7 rounded-2xl border border-[#3B2F2F]/10 bg-white/58 p-4 sm:p-5">
          <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
            <p className="text-3xl font-semibold text-[#2E2323] sm:text-[2rem]">
              {formatPkr(product.pricePkr)}
            </p>
            {getDiscountBadgeLabel(product) ? (
              <p className="text-base text-[#3B2F2F]/56 line-through">
                {formatPkr(product.compareAtPricePkr)}
              </p>
            ) : null}
          </div>
          <p className="mt-2 text-xs font-semibold tracking-[0.1em] text-[#6E2D2D] uppercase">
            {getAvailabilityLabel(product)}
          </p>
        </div>

        <div className="mt-8 space-y-4 rounded-2xl border border-[#3B2F2F]/10 bg-white/55 p-4 sm:p-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#3B2F2F]/55">
              Quantity &amp; preferences
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[#3B2F2F]/58">
              Quantity is used when you add to cart. Preferences below are included in your WhatsApp
              message if you check out there directly.
            </p>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium text-[#2E2323]" htmlFor="order-qty">
              Quantity
            </label>
            <select
              id="order-qty"
              className="h-11 w-full max-w-[12rem] rounded-full border border-[#3B2F2F]/14 bg-white/90 px-4 text-sm text-[#2E2323] outline-none focus-visible:ring-2 focus-visible:ring-[#3B2F2F]/25"
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

          <div className="grid gap-2">
            <label className="text-sm font-medium text-[#2E2323]" htmlFor="order-variant">
              Variant / preference
            </label>
            <Input
              id="order-variant"
              placeholder={variantPlaceholder}
              value={variantNote}
              disabled={disabled}
              onChange={(event) => setVariantNote(event.target.value)}
              className="h-11 rounded-full border-[#3B2F2F]/14 bg-white/90 px-4 text-base lg:text-sm"
            />
            <p className="text-xs text-[#3B2F2F]/58">
              Optional — we confirm the exact piece before packing.
            </p>
          </div>

          {productShowsSizeField(product) ? (
            <div className="grid gap-2">
              <label className="text-sm font-medium text-[#2E2323]" htmlFor="order-size">
                Size
              </label>
              <Input
                id="order-size"
                placeholder="e.g. newborn, 0–3 months (please confirm)"
                value={sizeNote}
                disabled={disabled}
                onChange={(event) => setSizeNote(event.target.value)}
                className="h-11 rounded-full border-[#3B2F2F]/14 bg-white/90 px-4 text-base lg:text-sm"
              />
            </div>
          ) : null}

          <div className="grid gap-2">
            <label className="text-sm font-medium text-[#2E2323]" htmlFor="order-note">
              Customer note
            </label>
            <textarea
              id="order-note"
              placeholder="Optional: gift note, preferred delivery timing, or other instructions"
              value={customerNote}
              disabled={disabled}
              onChange={(event) => setCustomerNote(event.target.value)}
              className="min-h-22 w-full rounded-2xl border border-[#3B2F2F]/14 bg-white/90 px-4 py-2.5 text-sm text-[#2E2323] outline-none focus-visible:ring-2 focus-visible:ring-[#3B2F2F]/25"
            />
          </div>

          <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-[#3B2F2F]/10 pt-4">
            <span className="text-sm text-[#3B2F2F]/72">
              {safeQty > 1 ? "Line total" : "Total"}
            </span>
            <span className="text-lg font-semibold text-[#2E2323]">
              {formatPkr(lineTotal)}
            </span>
          </div>
        </div>

        <ul className="mt-6 flex flex-wrap gap-2.5 text-sm text-[#3B2F2F]/76">
          <li className="rounded-full border border-[#3B2F2F]/12 bg-white/55 px-3.5 py-1.5">
            Care: Daily-use ready
          </li>
          <li className="rounded-full border border-[#3B2F2F]/12 bg-white/55 px-3.5 py-1.5">
            Dispatch: 24-48 hours
          </li>
          <li className="rounded-full border border-[#3B2F2F]/12 bg-white/55 px-3.5 py-1.5">
            Delivery: 2-5 business days
          </li>
        </ul>
        <div className="mt-5 rounded-2xl border border-[#3B2F2F]/10 bg-[#FBF7F3]/88 p-4 text-sm leading-relaxed text-[#3B2F2F]/76">
          <p>
            <span className="font-semibold text-[#241B1B]">Payment:</span> Cash on Delivery available across
            Pakistan for most orders.
          </p>
          <p>
            <span className="font-semibold text-[#241B1B]">Delivery:</span> {product.dispatchTimeline}{" "}
            {product.deliveryEstimate}
          </p>
          <p className="mt-2">
            <span className="font-semibold text-[#241B1B]">Care:</span> {product.careNote}
          </p>
          <p className="mt-2">
            <span className="font-semibold text-[#241B1B]">Gifting:</span> {product.giftingNote}
          </p>
          <p className="mt-2">
            <span className="font-semibold text-[#241B1B]">Returns support:</span> For damaged or
            incorrect items, message us within 48 hours of delivery with photos.
          </p>
          <p className="mt-3 text-xs text-[#3B2F2F]/68">
            Already placed an order?{" "}
            <Link href="/track-order" className="font-medium text-[#2E2323] underline underline-offset-2 hover:text-[#241B1B]">
              Track your order
            </Link>
            .
          </p>
        </div>

        <div className="mt-7 flex flex-col gap-3 sm:mt-9 sm:flex-row sm:flex-wrap sm:items-center">
          {disabled ? (
            <Button
              disabled
              className="h-11 w-full rounded-full bg-[#3B2F2F]/35 px-7 text-sm font-medium text-[#F6F1EC] sm:w-auto"
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
                className="h-12 w-full rounded-full border-[#2E2323]/16 bg-white/72 px-7 text-sm font-semibold text-[#2E2323] sm:h-11 sm:w-auto"
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
          <Button
            asChild
            variant="ghost"
            className="h-11 w-full rounded-full px-7 text-sm font-medium text-[#2E2323] sm:w-auto"
          >
            <Link href="/shop">Back to Shop</Link>
          </Button>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-2 sm:hidden">
        <div className="mx-auto max-w-md space-y-2 rounded-2xl border border-[#3B2F2F]/12 bg-[#FCF8F4]/96 p-3 shadow-[0_18px_38px_-24px_rgba(59,47,47,0.45)] backdrop-blur-md supports-[backdrop-filter]:bg-[#FCF8F4]/92">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-base font-semibold text-[#2E2323]">{formatPkr(lineTotal)}</p>
            {safeQty === 1 && getDiscountBadgeLabel(product) ? (
              <p className="text-[11px] text-[#3B2F2F]/58 line-through">
                {formatPkr(product.compareAtPricePkr)}
              </p>
            ) : (
              <p className="text-[11px] text-[#3B2F2F]/58">
                {safeQty} × {formatPkr(product.pricePkr)} each
              </p>
            )}
          </div>
          {disabled ? (
            <Button
              disabled
              className="h-11 w-full rounded-full bg-[#3B2F2F]/35 text-xs font-medium text-[#F6F1EC]"
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
                className="h-11 min-h-11 shrink-0 rounded-full border-[#2E2323]/16 bg-white/72 px-3 text-xs font-semibold text-[#2E2323]"
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
