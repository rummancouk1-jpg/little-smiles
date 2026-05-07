"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { capturePostHogEvent } from "@/lib/posthog-client";
import {
  type Product,
  clampOrderQuantity,
  formatPkr,
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
      }),
    [product, safeQty, variantNote, sizeNote],
  );

  const lineTotal = product.pricePkr * safeQty;

  const variantPlaceholder =
    product.category === "Bodysuits"
      ? "Print / color preference (as shown)"
      : product.category === "Food Container"
        ? "Which design / option (reference listing)"
        : "Color, print, or style preference";

  const trackWhatsApp = () => {
    capturePostHogEvent("whatsapp_order_clicked", {
      source: "product_detail",
      product_slug: product.slug,
      quantity: safeQty,
      has_variant_note: Boolean(variantNote.trim()),
      has_size_note: Boolean(sizeNote.trim()),
    });
  };

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
          <Badge className="border-transparent bg-[#2F2624] text-[#F6F1EC]">
            {product.discountPercent}% OFF
          </Badge>
        </div>
        <h1
          id="product-title"
          className="mt-4 text-3xl font-semibold tracking-tight text-[#1F1918] sm:mt-5 sm:text-5xl"
        >
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

        <div className="mt-8 space-y-4 rounded-2xl border border-[#3B2F2F]/10 bg-white/55 p-4 sm:p-5">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#3B2F2F]/55">
            WhatsApp order details
          </p>

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

          {productShowsVariantField(product) ? (
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
                className="h-11 rounded-full border-[#3B2F2F]/14 bg-white/90 px-4 text-base md:text-sm"
              />
              <p className="text-xs text-[#3B2F2F]/58">
                Optional — we confirm the exact piece before packing.
              </p>
            </div>
          ) : null}

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
                className="h-11 rounded-full border-[#3B2F2F]/14 bg-white/90 px-4 text-base md:text-sm"
              />
            </div>
          ) : null}

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
          {disabled ? (
            <Button
              disabled
              className="h-11 w-full rounded-full bg-[#3B2F2F]/35 px-7 text-sm font-medium text-[#F6F1EC] sm:w-auto"
              type="button"
            >
              Currently unavailable
            </Button>
          ) : (
            <Button
              asChild
              className="h-11 w-full rounded-full bg-[#2F2624] px-7 text-sm font-medium text-[#F6F1EC] shadow-[0_14px_32px_-20px_rgba(47,38,36,0.58)] transition-[transform,box-shadow,background-color] duration-300 hover:-translate-y-0.5 hover:bg-[#251E1D] hover:shadow-[0_18px_36px_-22px_rgba(47,38,36,0.66)] sm:w-auto"
            >
              <Link
                href={orderHref}
                target="_blank"
                rel="noreferrer"
                onClick={trackWhatsApp}
              >
                Order on WhatsApp
              </Link>
            </Button>
          )}
          <Button
            asChild
            variant="outline"
            className="h-11 w-full rounded-full border-[#2E2323]/16 bg-white/62 px-7 text-sm font-medium text-[#2E2323] hover:bg-white/84 sm:w-auto"
          >
            <Link href="/shop">Back to Shop</Link>
          </Button>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-3 z-40 px-4 sm:hidden">
        <div className="mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl border border-[#3B2F2F]/12 bg-[#FCF8F4]/96 p-3 shadow-[0_18px_38px_-24px_rgba(59,47,47,0.45)] backdrop-blur-md">
          <div>
            <p className="text-sm font-semibold text-[#2E2323]">{formatPkr(lineTotal)}</p>
            {safeQty === 1 ? (
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
              className="h-10 shrink-0 rounded-full bg-[#3B2F2F]/35 px-4 text-xs font-medium text-[#F6F1EC]"
              type="button"
            >
              Unavailable
            </Button>
          ) : (
            <Button
              asChild
              className="h-10 shrink-0 rounded-full bg-[#2F2624] px-4 text-xs font-medium text-[#F6F1EC]"
            >
              <Link
                href={orderHref}
                target="_blank"
                rel="noreferrer"
                onClick={trackWhatsApp}
              >
                WhatsApp order
              </Link>
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
