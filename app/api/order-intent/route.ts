import { NextResponse } from "next/server";
import { z } from "zod";

import { getProductBySlug } from "@/lib/products";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const orderIntentSchema = z.object({
  productSlug: z.string().min(1).max(200).optional(),
  productName: z.string().min(1).max(200).optional(),
  category: z.string().min(1).max(120).optional(),
  pricePkr: z.number().int().min(0).max(1_000_000).optional(),
  sourcePage: z.string().min(1).max(240),
  timestamp: z.string().datetime(),
  userAgent: z.string().min(1).max(1000).optional(),
});

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: true, tracked: false });
  }

  const parsed = orderIntentSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: true, tracked: false });
  }

  const payload = parsed.data;
  if (payload.productSlug) {
    const product = getProductBySlug(payload.productSlug);
    if (!product) {
      console.warn("[order-intent] unknown product slug", payload.productSlug);
      return NextResponse.json({ ok: true, tracked: false, reason: "unknown_product" });
    }
  }

  try {
    console.info("[order-intent]", JSON.stringify(payload));
    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ ok: true, tracked: false, reason: "supabase_not_configured" });
    }

    const { error } = await supabase.from("order_intents").insert({
      product_slug: payload.productSlug ?? null,
      product_name: payload.productName ?? null,
      category: payload.category ?? null,
      price_pkr: payload.pricePkr ?? null,
      source_page: payload.sourcePage,
      event_timestamp: payload.timestamp,
      user_agent: payload.userAgent ?? null,
      // Server-side ingestion timestamp (separate from click timestamp from client).
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.warn("[order-intent] supabase insert failed", error.message);
      return NextResponse.json({ ok: true, tracked: false, reason: "insert_failed" });
    }

    return NextResponse.json({ ok: true, tracked: true });
  } catch {
    return NextResponse.json({ ok: true, tracked: false });
  }
}
