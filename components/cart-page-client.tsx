"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, Trash2 } from "lucide-react";

import { useCart } from "@/components/cart-provider";
import { Button } from "@/components/ui/button";
import { getCartWhatsappCheckoutUrl } from "@/lib/cart-checkout";
import { trackCartCheckoutAndOpenWhatsapp } from "@/lib/order-intent-client";
import {
  formatPkr,
  getDiscountBadgeLabel,
  getImageCandidates,
} from "@/lib/products";
import { ProductImage } from "@/components/product-image";
import { cn } from "@/lib/utils";

export function CartPageClient() {
  const { resolvedLines, setQuantity, removeLine, totalQuantity, subtotalPkr } =
    useCart();

  const checkoutLines = resolvedLines.map((line) => ({
    product: line.product,
    quantity: line.quantity,
  }));

  const handleCheckout = () => {
    if (checkoutLines.length === 0) return;
    const url = getCartWhatsappCheckoutUrl(checkoutLines);
    void trackCartCheckoutAndOpenWhatsapp(url, {
      itemCount: checkoutLines.length,
      totalQuantity,
      subtotalPkr,
      productSlugs: checkoutLines.map((l) => l.product.slug),
    });
  };

  if (resolvedLines.length === 0) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="rounded-3xl border border-[#3B2F2F]/10 bg-[#FCF8F4]/94 p-10 text-center shadow-[0_24px_52px_-34px_rgba(59,47,47,0.28)]">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#F2EAE4]">
            <Image
              src="/products/logo.png"
              alt=""
              width={48}
              height={48}
              className="h-10 w-10 object-contain opacity-90"
            />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1F1918] sm:text-3xl">
            Your cart is empty
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[#3B2F2F]/72">
            Browse the shop and use <span className="font-medium text-[#2E2323]">Add to cart</span>{" "}
            on any product. Your selections are saved on this device until you check out on WhatsApp.
          </p>
          <Button
            asChild
            className="mt-8 h-12 rounded-full bg-[#2F2624] px-8 text-sm font-semibold text-[#F6F1EC] shadow-[0_14px_34px_-20px_rgba(47,38,36,0.56)]"
          >
            <Link href="/shop">Continue shopping</Link>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <div className="mb-8">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-[#3B2F2F]/52">
          Little Smiles
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#1F1918] sm:text-4xl">
          Your cart
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[#3B2F2F]/72">
          {totalQuantity} {totalQuantity === 1 ? "item" : "items"} · Subtotal{" "}
          <span className="font-semibold text-[#2E2323]">{formatPkr(subtotalPkr)}</span>
        </p>
      </div>

      <ul className="space-y-4">
        {resolvedLines.map((line) => {
          const { product, quantity, productSlug } = line;
          const lineTotal = product.pricePkr * quantity;
          const maxQty = product.inventoryQty;
          const limited = product.availabilityStatus === "limited_stock";

          return (
            <li
              key={productSlug}
              className="flex flex-col gap-4 rounded-3xl border border-[#3B2F2F]/10 bg-[#FCF8F4]/94 p-4 shadow-[0_20px_48px_-32px_rgba(59,47,47,0.32)] sm:flex-row sm:items-center sm:gap-5 sm:p-5"
            >
              <Link
                href={`/shop/${product.slug}`}
                className="relative mx-auto h-36 w-full shrink-0 overflow-hidden rounded-2xl bg-[#F5EEE7] sm:mx-0 sm:h-28 sm:w-28"
              >
                <ProductImage
                  sources={getImageCandidates(product.image)}
                  alt={product.name}
                  fill
                  className="object-contain object-center"
                  sizes="(max-width: 640px) 100vw, 7rem"
                />
              </Link>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-[#3B2F2F]/12 bg-white/66 px-2.5 py-0.5 text-xs font-medium text-[#3B2F2F]/74">
                    {product.category}
                  </span>
                  {getDiscountBadgeLabel(product) ? (
                    <span className="rounded-full bg-[#2F2624] px-2.5 py-0.5 text-xs font-medium text-[#F6F1EC]">
                      {getDiscountBadgeLabel(product)}
                    </span>
                  ) : null}
                </div>
                <Link
                  href={`/shop/${product.slug}`}
                  className="mt-2 block text-lg font-semibold text-[#1F1918] hover:underline"
                >
                  {product.name}
                </Link>
                <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="text-base font-semibold text-[#2E2323]">
                    {formatPkr(product.pricePkr)}
                  </span>
                  {getDiscountBadgeLabel(product) ? (
                    <span className="text-sm text-[#3B2F2F]/56 line-through">
                      {formatPkr(product.compareAtPricePkr)}
                    </span>
                  ) : null}
                </div>
                {limited ? (
                  <p className="mt-2 text-xs font-medium tracking-[0.08em] text-[#6E2D2D] uppercase">
                    Only {maxQty} left — order soon
                  </p>
                ) : null}
              </div>

              <div className="flex flex-row items-center justify-between gap-3 sm:flex-col sm:items-end">
                <div className="flex items-center gap-1 rounded-full border border-[#3B2F2F]/14 bg-white/72 p-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="rounded-full text-[#2E2323]"
                    aria-label="Decrease quantity"
                    disabled={quantity <= 1}
                    onClick={() => setQuantity(productSlug, quantity - 1)}
                  >
                    <Minus className="size-4" />
                  </Button>
                  <span className="min-w-8 text-center text-sm font-semibold tabular-nums text-[#2E2323]">
                    {quantity}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="rounded-full text-[#2E2323]"
                    aria-label="Increase quantity"
                    disabled={quantity >= maxQty}
                    onClick={() => setQuantity(productSlug, quantity + 1)}
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
                <div className="text-right">
                  <p className="text-xs text-[#3B2F2F]/62">Line total</p>
                  <p className="text-lg font-semibold text-[#2E2323]">{formatPkr(lineTotal)}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    "rounded-full border-[#3B2F2F]/16 text-[#6E2D2D] hover:bg-[#FDF8F5]",
                    "sm:mt-1",
                  )}
                  onClick={() => removeLine(productSlug)}
                >
                  <Trash2 className="mr-1.5 size-3.5" />
                  Remove
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-10 space-y-6 rounded-3xl border border-[#3B2F2F]/10 bg-white/55 p-6 sm:p-8">
        <div className="flex flex-col gap-2 border-b border-[#3B2F2F]/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-[#3B2F2F]/72">Subtotal</p>
            <p className="text-2xl font-semibold text-[#2E2323]">{formatPkr(subtotalPkr)}</p>
            <p className="mt-2 text-xs text-[#3B2F2F]/64">
              Shipping and final total are confirmed on WhatsApp for your address.
            </p>
          </div>
          <Button
            type="button"
            className="h-12 w-full rounded-full bg-[#2F2624] px-8 text-sm font-semibold text-[#F6F1EC] shadow-[0_16px_34px_-18px_rgba(47,38,36,0.6)] transition-[transform,box-shadow,background-color] duration-300 hover:-translate-y-0.5 hover:bg-[#251E1D] sm:mt-0 sm:w-auto sm:shrink-0"
            onClick={handleCheckout}
          >
            Checkout on WhatsApp
          </Button>
        </div>
        <div className="grid gap-4 text-sm leading-relaxed text-[#3B2F2F]/76 sm:grid-cols-2">
          <div className="rounded-2xl border border-[#3B2F2F]/8 bg-[#FBF7F3]/88 p-4">
            <p className="font-semibold text-[#241B1B]">Delivery</p>
            <p className="mt-2">
              Most orders dispatch within 24–48 hours after confirmation; typical transit is 2–5
              business days across Pakistan. We&apos;ll align courier details on WhatsApp.
            </p>
          </div>
          <div className="rounded-2xl border border-[#3B2F2F]/8 bg-[#FBF7F3]/88 p-4">
            <p className="font-semibold text-[#241B1B]">Returns &amp; support</p>
            <p className="mt-2">
              For damaged or incorrect items, message us within 48 hours of delivery with photos. We
              aim to resolve issues fairly and quickly.
            </p>
          </div>
        </div>
        <p className="text-center text-xs text-[#3B2F2F]/58">
          <Link href="/shop" className="font-medium text-[#2E2323] underline underline-offset-2">
            Continue shopping
          </Link>
        </p>
      </div>
    </main>
  );
}
