import { NextResponse } from "next/server";
import { z } from "zod";

import { getProductBySlug } from "@/lib/products";
import { checkRequestRateLimit } from "@/lib/request-rate-limit";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

const bodySchema = z.object({
  source: z.string().min(1).max(80),
  product_slug: z.string().min(1).max(200).optional(),
  quantity: z.number().int().min(1).max(99).optional(),
  has_variant_note: z.boolean().optional(),
  has_size_note: z.boolean().optional(),
});

/**
 * Server-side log + optional webhook for WhatsApp order intents (alongside PostHog).
 * Set `WHATSAPP_CLICK_WEBHOOK_URL` or reuse `CONTACT_NOTIFY_WEBHOOK_URL` (same payload shape).
 */
export async function POST(request: Request) {
  const rate = checkRequestRateLimit({
    request,
    routeKey: "events_whatsapp_order",
    limit: 90,
    windowMs: 10 * 60 * 1000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many events." },
      {
        status: 429,
        headers: {
          ...NO_STORE_HEADERS,
          "Retry-After": String(rate.retryAfterSeconds),
        },
      },
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid body." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const slug = parsed.data.product_slug;
  if (slug && !getProductBySlug(slug)) {
    return NextResponse.json(
      { ok: false, error: "Unknown product." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const payload = {
    kind: "whatsapp_order_click" as const,
    receivedAt: new Date().toISOString(),
    ...parsed.data,
  };

  console.info("[whatsapp-order-event]", JSON.stringify(payload));

  const webhook =
    process.env.WHATSAPP_CLICK_WEBHOOK_URL?.trim() ||
    process.env.CONTACT_NOTIFY_WEBHOOK_URL?.trim();

  if (webhook) {
    try {
      const res = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) {
        console.warn("[whatsapp-order-event] webhook status", res.status);
      }
    } catch (err) {
      console.warn("[whatsapp-order-event] webhook failed", err);
    }
  }

  return NextResponse.json({ ok: true }, { headers: NO_STORE_HEADERS });
}
