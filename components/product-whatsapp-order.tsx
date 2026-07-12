"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { AddToCartButton } from "@/components/add-to-cart-button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import { cn } from "@/lib/utils";

type ProductWhatsappOrderProps = {
  product: Product;
};

export function ProductWhatsappOrder({ product }: ProductWhatsappOrderProps) {
  const maxQty = Math.max(1, product.inventoryQty);
  const [quantity, setQuantity] = useState(1);
  const [variantNote, setVariantNote] = useState("");
  const [sizeNote, setSizeNote] = useState("");
  const [customerNote, setCustomerNote] = useState("");

  // Desktop sticky buy-bar: reveal it once the primary buy cluster has scrolled
  // up out of view (presentation only — the CTA wiring is reused verbatim).
  const buyRef = useRef<HTMLDivElement | null>(null);
  const [showBuyBar, setShowBuyBar] = useState(false);
  // Hide the desktop bar once the page's end-of-content sentinel scrolls into
  // view, so the fixed bar never sits over the footer (a visible defect).
  const [atBottom, setAtBottom] = useState(false);

  useEffect(() => {
    setQuantity((previous) => clampOrderQuantity(product, previous));
  }, [product]);

  useEffect(() => {
    const el = buyRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowBuyBar(!entry.isIntersecting && entry.boundingClientRect.top < 0);
      },
      { threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const sentinel = document.getElementById("pdp-scroll-end");
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => setAtBottom(entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

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
            className="border-ink-base/12 bg-surface-raised/65 text-ink-base/74"
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

        <div className="mt-7 rounded-2xl border border-ink-base/10 bg-surface-raised/58 p-4 sm:p-5">
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
          <p
            className={cn(
              "mt-2 text-xs font-semibold tracking-[0.1em] uppercase",
              // Availability is per-state: trust green only when buyable.
              product.inStock ? "text-tone-availability" : "text-tone-danger",
            )}
          >
            {getAvailabilityLabel(product)}
          </p>
        </div>

        {/* Decision cluster — quantity + the primary buy actions, directly under
            the price so the buyer can act without scrolling past anything. */}
        <div ref={buyRef} className="mt-6 space-y-4">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-ink-walnut" htmlFor="order-qty">
              Quantity
            </label>
            <select
              id="order-qty"
              className="h-11 w-full max-w-[9.5rem] rounded-full border border-ink-base/14 bg-surface-raised/90 px-4 text-sm text-ink-walnut outline-none focus-visible:ring-2 focus-visible:ring-ink-base/25"
              value={safeQty}
              disabled={disabled}
              onChange={(event) =>
                setQuantity(Number.parseInt(event.target.value, 10) || 1)
              }
            >
              {Array.from({ length: maxQty }, (_, index) => index + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                  {product.inStock && product.inventoryQty === 1
                    ? " (only one available)"
                    : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-ink-base/10 pt-3">
            <span className="text-sm text-ink-base/68">
              {safeQty > 1 ? "Line total" : "Total"}
            </span>
            <span className="text-lg font-semibold text-ink-walnut">
              {formatPkr(lineTotal)}
            </span>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            {disabled ? (
              <Button
                disabled
                className="h-12 w-full rounded-full bg-ink-base/35 px-7 text-sm font-medium text-ink-foreground sm:w-auto"
                type="button"
              >
                Currently unavailable
              </Button>
            ) : (
              <>
                <AddToCartButton
                  product={product}
                  quantity={safeQty}
                  className="h-12 min-h-12 w-full sm:h-11 sm:w-auto sm:min-w-[13rem]"
                />
                <Button
                  asChild
                  variant="outline"
                  className="h-12 w-full rounded-full border-dashed border-ink-base/35 bg-transparent shadow-none px-7 text-sm font-semibold text-ink-walnut sm:h-11 sm:w-auto"
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
          </div>
        </div>

        {/* Optional details + policies folded into a tidy accordion (both
            collapsed) so they don't sit between the buyer and the CTA. Field
            state lives in the parent, so collapsing preserves anything typed. */}
        <Accordion
          type="multiple"
          className="mt-8 rounded-2xl border border-ink-base/10 bg-surface-raised/45 px-4 sm:px-5"
        >
          <AccordionItem value="details" className="border-ink-base/10">
            <AccordionTrigger className="text-ink-walnut hover:no-underline">
              <span>
                Add your details{" "}
                <span className="font-normal text-ink-base/50">(optional)</span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-4">
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
                    className="h-11 rounded-full border-ink-base/14 bg-surface-raised/90 px-4 text-base lg:text-sm"
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
                    className="h-11 rounded-full border-ink-base/14 bg-surface-raised/90 px-4 text-base lg:text-sm"
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
                  className="min-h-22 w-full rounded-2xl border border-ink-base/14 bg-surface-raised/90 px-4 py-2.5 text-sm text-ink-walnut outline-none focus-visible:ring-2 focus-visible:ring-ink-base/25"
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="shipping" className="border-ink-base/10">
            <AccordionTrigger className="text-ink-walnut hover:no-underline">
              Shipping, care &amp; returns
            </AccordionTrigger>
            <AccordionContent className="text-ink-base/76">
              <p>
                <span className="font-semibold text-ink-espresso">Payment:</span> Cash on delivery, available across Pakistan.
              </p>
              <p>
                <span className="font-semibold text-ink-espresso">Shipping:</span> {product.dispatchTimeline}{" "}
                {product.deliveryEstimate}
              </p>
              <p>
                <span className="font-semibold text-ink-espresso">Care:</span> {product.careNote}
              </p>
              <p>
                <span className="font-semibold text-ink-espresso">Gifting:</span> {product.giftingNote}
              </p>
              <p>
                <span className="font-semibold text-ink-espresso">Returns:</span> Message us within 48 hours of delivery for damaged or wrong items, with photos.
              </p>
              <p className="text-xs text-ink-base/68">
                Already placed an order?{" "}
                <Link href="/track-order" className="font-medium text-ink-walnut hover:text-ink-espresso">
                  Track your order
                </Link>
                .
              </p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="mt-7">
          <Link
            href="/shop"
            className="group inline-flex h-11 items-center gap-1.5 text-sm font-medium text-ink-base/72 underline decoration-ink-base/20 underline-offset-[6px] transition-[color,text-decoration-color] duration-200 hover:text-ink-espresso hover:decoration-ink-espresso/45"
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
                className="h-11 min-h-11 shrink-0 rounded-full border-dashed border-ink-base/35 bg-transparent shadow-none px-3 text-xs font-semibold text-ink-walnut"
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

      {showBuyBar && !atBottom && !disabled ? (
        <div className="fixed inset-x-0 bottom-0 z-40 hidden border-t border-ink-base/12 bg-surface-card/92 backdrop-blur-md supports-[backdrop-filter]:bg-surface-card/85 lg:block">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-8 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink-walnut">{product.name}</p>
              <p className="text-sm">
                <span className="font-semibold text-ink-walnut">{formatPkr(lineTotal)}</span>
                {safeQty > 1 ? (
                  <span className="ml-2 text-ink-base/55">
                    {safeQty} × {formatPkr(product.pricePkr)}
                  </span>
                ) : null}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <AddToCartButton
                product={product}
                quantity={safeQty}
                className="h-11 min-h-11 min-w-[12rem]"
              />
              <Button
                asChild
                variant="outline"
                className="h-11 rounded-full border-dashed border-ink-base/35 bg-transparent shadow-none px-6 text-sm font-semibold text-ink-walnut"
              >
                <Link
                  href={orderHref}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(event) =>
                    void trackAndOpenWhatsapp(event, {
                      whatsappUrl: orderHref,
                      sourcePage: "product_detail_desktop_bar",
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
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
