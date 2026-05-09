"use client";

import Image from "next/image";
import Link from "next/link";
import { Check, Minus, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { AddToCartButton } from "@/components/add-to-cart-button";
import { useCart } from "@/components/cart-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCartWhatsappCheckoutUrl } from "@/lib/cart-checkout";
import { trackCartCheckoutAndOpenWhatsapp } from "@/lib/order-intent-client";
import {
  formatPkr,
  getCartUpsellProducts,
  getDiscountBadgeLabel,
  getImageCandidates,
} from "@/lib/products";
import { ProductImage } from "@/components/product-image";
import { cn } from "@/lib/utils";

const fieldClass =
  "h-11 rounded-2xl border-[#3B2F2F]/14 bg-white/88 px-4 text-base text-[#2E2323] outline-none transition-[border-color,box-shadow] placeholder:text-[#3B2F2F]/45 focus-visible:border-[#3B2F2F]/32 focus-visible:ring-2 focus-visible:ring-[#3B2F2F]/18 lg:text-sm";

function validateCheckoutForm(data: {
  fullName: string;
  phone: string;
  city: string;
  address: string;
}): string | null {
  if (data.fullName.trim().length < 2) return "Please enter your full name.";
  if (data.phone.replace(/\s+/g, "").length < 7) return "Please enter a valid phone number.";
  if (data.city.trim().length < 2) return "Please enter your city.";
  if (data.address.trim().length < 5) return "Please enter your delivery address.";
  return null;
}

const stepperBtnClass =
  "size-9 shrink-0 rounded-full border-[#3B2F2F]/24 bg-white/95 text-[#2E2323] shadow-sm hover:bg-[#F2EAE4] disabled:opacity-40";

export function CartPageClient() {
  const { resolvedLines, setQuantity, removeLine, totalQuantity, subtotalPkr } =
    useCart();

  const upsellProducts = getCartUpsellProducts(
    resolvedLines.map((l) => l.productSlug),
    4,
  );

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const checkoutLines = resolvedLines.map((line) => ({
    product: line.product,
    quantity: line.quantity,
  }));

  const handleCheckout = () => {
    if (checkoutLines.length === 0) return;
    const customer = {
      fullName,
      phone,
      city,
      address,
      note,
    };
    const err = validateCheckoutForm(customer);
    if (err) {
      setFormError(err);
      return;
    }
    setFormError(null);
    const url = getCartWhatsappCheckoutUrl(checkoutLines, {
      fullName: customer.fullName.trim(),
      phone: customer.phone.trim(),
      city: customer.city.trim(),
      address: customer.address.trim(),
      note: customer.note.trim(),
    });
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
              className="flex flex-col gap-4 rounded-3xl border border-[#3B2F2F]/10 bg-[#FCF8F4]/94 p-4 shadow-[0_20px_48px_-32px_rgba(59,47,47,0.32)] sm:flex-row sm:items-start sm:gap-5 sm:p-5"
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

              <div className="flex w-full shrink-0 flex-col gap-4 border-t border-[#3B2F2F]/10 pt-4 sm:mt-0 sm:w-72 sm:border-t-0 sm:border-l sm:pl-5 sm:pt-0">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="mb-1.5 text-xs font-medium uppercase tracking-[0.1em] text-[#3B2F2F]/58">
                      Quantity
                    </p>
                    <div className="inline-flex items-center gap-1 rounded-full border border-[#3B2F2F]/20 bg-white/95 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        className={stepperBtnClass}
                        aria-label="Decrease quantity"
                        disabled={quantity <= 1}
                        onClick={() => setQuantity(productSlug, quantity - 1)}
                      >
                        <Minus className="size-4" strokeWidth={2.25} />
                      </Button>
                      <span className="min-w-10 px-1 text-center text-sm font-semibold tabular-nums text-[#2E2323]">
                        {quantity}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        className={stepperBtnClass}
                        aria-label="Increase quantity"
                        disabled={quantity >= maxQty}
                        onClick={() => setQuantity(productSlug, quantity + 1)}
                      >
                        <Plus className="size-4" strokeWidth={2.25} />
                      </Button>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-[#3B2F2F]/62">Line total</p>
                    <p className="text-lg font-semibold text-[#2E2323]">{formatPkr(lineTotal)}</p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-10 w-full rounded-full border-[#3B2F2F]/36 bg-white/95 text-sm font-semibold text-[#1F1918] hover:bg-[#F8F4F0] hover:text-[#1F1918] dark:text-[#1F1918] dark:hover:text-[#1F1918] sm:w-auto [&_svg]:text-[#1F1918]"
                  onClick={() => removeLine(productSlug)}
                >
                  <Trash2 className="mr-2 size-4" aria-hidden />
                  Remove from cart
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      {upsellProducts.length > 0 ? (
        <section
          className="mt-10"
          aria-labelledby="cart-upsell-heading"
        >
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#3B2F2F]/52">
                Complete the order
              </p>
              <h2
                id="cart-upsell-heading"
                className="mt-1.5 text-xl font-semibold tracking-tight text-[#1F1918] sm:text-2xl"
              >
                You may also like
              </h2>
            </div>
            <Link
              href="/shop"
              className="text-sm font-medium text-[#2E2323] underline underline-offset-2 hover:text-[#1F1918]"
            >
              View all
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {upsellProducts.map((item) => (
              <article
                key={item.slug}
                className="flex flex-col rounded-2xl border border-[#3B2F2F]/10 bg-[#FCF8F4]/94 p-3.5 shadow-[0_18px_40px_-28px_rgba(59,47,47,0.3)]"
              >
                <Link href={`/shop/${item.slug}`} className="group block">
                  <div className="relative h-36 rounded-xl bg-[#F5EEE7] p-3">
                    <ProductImage
                      sources={getImageCandidates(item.image)}
                      alt={item.name}
                      fill
                      className="object-contain object-center"
                      sizes="(max-width: 640px) 100vw, 25vw"
                    />
                  </div>
                  <p className="mt-2.5 line-clamp-2 text-sm font-semibold text-[#2E2323] group-hover:underline">
                    {item.name}
                  </p>
                </Link>
                <p className="mt-1 text-sm font-semibold text-[#2E2323]">{formatPkr(item.pricePkr)}</p>
                <AddToCartButton
                  product={item}
                  size="sm"
                  className="mt-3 h-9 w-full text-xs"
                  label="Add to cart"
                />
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <div className="mt-10 space-y-8 rounded-3xl border border-[#3B2F2F]/10 bg-white/55 p-6 shadow-[0_20px_48px_-32px_rgba(59,47,47,0.22)] sm:p-8">
        <div className="border-b border-[#3B2F2F]/10 pb-6">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#3B2F2F]/52">
            Checkout
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-[#1F1918] sm:text-2xl">
            Cash on Delivery
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#3B2F2F]/74">
            Review your order summary, add your delivery details, then confirm on WhatsApp. No card
            or online payment is required.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-[#3B2F2F]/10 bg-[#FBF7F3]/92 p-4 sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#3B2F2F]/55">
              Order summary
            </p>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex flex-col gap-0.5 border-b border-[#3B2F2F]/8 pb-3">
                <dt className="font-medium text-[#3B2F2F]/68">Payment method</dt>
                <dd className="font-semibold text-[#2E2323]">Cash on Delivery</dd>
              </div>
              <div className="flex flex-col gap-0.5 border-b border-[#3B2F2F]/8 pb-3">
                <dt className="font-medium text-[#3B2F2F]/68">Delivery</dt>
                <dd className="text-[#2E2323]">Confirmed on WhatsApp for your address</dd>
              </div>
              <div className="flex flex-col gap-0.5 border-b border-[#3B2F2F]/8 pb-3">
                <dt className="font-medium text-[#3B2F2F]/68">Shipping fee</dt>
                <dd className="text-[#2E2323]">Confirmed after city &amp; address</dd>
              </div>
              <div className="flex flex-col gap-0.5 pt-0.5">
                <dt className="font-medium text-[#3B2F2F]/68">Final total</dt>
                <dd className="text-[#2E2323]">Confirmed before dispatch (subtotal + delivery)</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl border border-[#3B2F2F]/10 bg-[#F2EAE4]/55 p-4 sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#3B2F2F]/55">
              Why shop with us
            </p>
            <ul className="mt-4 space-y-3 text-sm leading-snug text-[#2E2323]">
              <li className="flex gap-2.5">
                <Check
                  className="mt-0.5 size-4 shrink-0 text-[#3B5F4A]"
                  strokeWidth={2.25}
                  aria-hidden
                />
                <span>No online payment required — pay the courier or as agreed on WhatsApp.</span>
              </li>
              <li className="flex gap-2.5">
                <Check
                  className="mt-0.5 size-4 shrink-0 text-[#3B5F4A]"
                  strokeWidth={2.25}
                  aria-hidden
                />
                <span>Your order is confirmed manually on WhatsApp with our team.</span>
              </li>
              <li className="flex gap-2.5">
                <Check
                  className="mt-0.5 size-4 shrink-0 text-[#3B5F4A]"
                  strokeWidth={2.25}
                  aria-hidden
                />
                <span>Final amount is confirmed before dispatch, including delivery.</span>
              </li>
            </ul>
          </div>
        </div>

        <form
          className="flex flex-col gap-8"
          onChange={() => setFormError(null)}
          onSubmit={(e) => {
            e.preventDefault();
            handleCheckout();
          }}
        >
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#3B2F2F]/55">
              Delivery details
            </p>
            <p className="mt-1 text-sm text-[#3B2F2F]/68">
              We&apos;ll pre-fill WhatsApp with this information. Double-check your phone number.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-[#2E2323]" htmlFor="cart-name">
                Full name
              </label>
              <Input
                id="cart-name"
                name="name"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={fieldClass}
                placeholder="e.g. Ayesha Khan"
              />
              </div>
              <div>
              <label className="mb-1.5 block text-sm font-medium text-[#2E2323]" htmlFor="cart-phone">
                Phone (WhatsApp)
              </label>
              <Input
                id="cart-phone"
                name="tel"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={fieldClass}
                placeholder="e.g. 0300 1234567"
              />
              </div>
              <div>
              <label className="mb-1.5 block text-sm font-medium text-[#2E2323]" htmlFor="cart-city">
                City
              </label>
              <Input
                id="cart-city"
                name="address-level2"
                autoComplete="address-level2"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className={fieldClass}
                placeholder="e.g. Karachi"
              />
              </div>
              <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-[#2E2323]" htmlFor="cart-address">
                Address
              </label>
              <textarea
                id="cart-address"
                name="street-address"
                autoComplete="street-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={3}
                className={cn(fieldClass, "min-h-[5.5rem] resize-y py-3")}
                placeholder="Area, street, house or flat no., landmark"
              />
              </div>
              <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-[#2E2323]" htmlFor="cart-note">
                Note <span className="font-normal text-[#3B2F2F]/58">(optional)</span>
              </label>
              <textarea
                id="cart-note"
                name="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className={cn(fieldClass, "min-h-[4.5rem] resize-y py-3")}
                placeholder="Gift message, delivery timing, or product preferences"
              />
              </div>
            </div>
            {formError ? (
              <p className="mt-3 text-sm font-medium text-[#8B3A3A]" role="alert">
                {formError}
              </p>
            ) : null}
          </div>

          <div className="flex w-full min-w-0 flex-col gap-4 border-t border-[#3B2F2F]/10 pt-6 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
            <div className="min-w-0 max-w-xl">
              <p className="text-sm text-[#3B2F2F]/72">Cart subtotal</p>
              <p className="text-2xl font-semibold text-[#2E2323]">{formatPkr(subtotalPkr)}</p>
              <p className="mt-1 text-xs leading-relaxed text-[#3B2F2F]/62">
                Delivery is added after we confirm your city. Final COD total is shared on WhatsApp
                before we dispatch.
              </p>
            </div>
            <div className="w-full shrink-0 sm:w-auto sm:max-w-[min(100%,18.5rem)] sm:pt-0.5">
              <Button
                type="submit"
                className="h-12 w-full rounded-full bg-[#2F2624] px-6 text-sm font-semibold text-[#F6F1EC] shadow-[0_16px_34px_-18px_rgba(47,38,36,0.6)] transition-[box-shadow,background-color] duration-300 hover:bg-[#251E1D] sm:min-w-[14rem]"
              >
                Confirm COD Order on WhatsApp
              </Button>
            </div>
          </div>
        </form>

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
