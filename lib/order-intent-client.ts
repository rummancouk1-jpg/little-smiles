"use client";

import type { MouseEvent } from "react";

import { capturePostHogEvent } from "@/lib/posthog-client";

export type OrderIntentPayload = {
  productSlug?: string;
  productName?: string;
  category?: string;
  pricePkr?: number;
  sourcePage: string;
};

type TrackAndOpenArgs = {
  whatsappUrl: string;
  sourcePage: string;
  productSlug?: string;
  productName?: string;
  category?: string;
  pricePkr?: number;
};

function withRuntimeFields(payload: OrderIntentPayload) {
  return {
    ...payload,
    timestamp: new Date().toISOString(),
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
  };
}

export async function logOrderIntent(payload: OrderIntentPayload): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    await fetch("/api/order-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(withRuntimeFields(payload)),
      keepalive: true,
    });
  } catch {
    // Swallow errors so WhatsApp ordering never gets blocked.
  }
}

export async function trackAndOpenWhatsapp(
  event: MouseEvent<HTMLElement>,
  args: TrackAndOpenArgs,
): Promise<void> {
  event.preventDefault();
  const pageContext =
    typeof window !== "undefined" ? `${args.sourcePage}:${window.location.pathname}` : args.sourcePage;

  capturePostHogEvent("whatsapp_order_clicked", {
    productSlug: args.productSlug,
    category: args.category,
    pricePkr: args.pricePkr,
    sourcePage: pageContext,
    product_slug: args.productSlug,
    source: pageContext,
  });

  const intent = logOrderIntent({
    productSlug: args.productSlug,
    productName: args.productName,
    category: args.category,
    pricePkr: args.pricePkr,
    sourcePage: pageContext,
  });

  await Promise.race([
    intent,
    new Promise<void>((resolve) => window.setTimeout(resolve, 180)),
  ]);

  window.open(args.whatsappUrl, "_blank", "noopener,noreferrer");
}

export async function trackCartCheckoutAndOpenWhatsapp(
  whatsappUrl: string,
  meta: {
    itemCount: number;
    totalQuantity: number;
    subtotalPkr: number;
    productSlugs: string[];
  },
): Promise<void> {
  const pageContext =
    typeof window !== "undefined"
      ? `cart_checkout:${window.location.pathname}`
      : "cart_checkout";

  capturePostHogEvent("cart_whatsapp_checkout_clicked", {
    item_count: meta.itemCount,
    total_quantity: meta.totalQuantity,
    subtotal_pkr: meta.subtotalPkr,
    product_slugs: meta.productSlugs,
    source: pageContext,
  });

  const intent = logOrderIntent({
    productName: `Cart checkout (${meta.itemCount} items)`,
    pricePkr: Math.round(meta.subtotalPkr),
    sourcePage: pageContext,
  });

  await Promise.race([
    intent,
    new Promise<void>((resolve) => window.setTimeout(resolve, 180)),
  ]);

  window.open(whatsappUrl, "_blank", "noopener,noreferrer");
}
