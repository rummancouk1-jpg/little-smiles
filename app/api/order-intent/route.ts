import { NextResponse } from "next/server";
import { z } from "zod";

import { captureServerError } from "@/lib/error-observability";
import { getProductBySlug } from "@/lib/products";
import { checkRequestRateLimit } from "@/lib/request-rate-limit";
import { getSupabaseAdminClient, getSupabaseRuntimeChecks } from "@/lib/supabase-admin";

const orderIntentSchema = z.object({
  productSlug: z.string().min(1).max(200).optional(),
  productName: z.string().min(1).max(200).optional(),
  category: z.string().min(1).max(120).optional(),
  pricePkr: z.number().int().min(0).max(1_000_000).optional(),
  sourcePage: z.string().min(1).max(240),
  timestamp: z.string().datetime(),
  userAgent: z.string().min(1).max(1000).optional(),
});

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

/**
 * Debug context is logged server-side only — never returned in the HTTP body,
 * so Supabase host, env-check booleans, and Postgres error codes do not leak
 * via preview deployments or to anyone hitting the endpoint.
 */
function successResponse(
  tracked: boolean,
  debug?: { reason?: string; details?: Record<string, unknown> },
) {
  if (debug && !tracked) {
    console.warn("[order-intent] not tracked", debug);
  }
  return NextResponse.json({ ok: true, tracked }, { headers: NO_STORE_HEADERS });
}

export async function POST(request: Request) {
  const rate = checkRequestRateLimit({
    request,
    routeKey: "order_intent",
    limit: 90,
    windowMs: 10 * 60 * 1000,
  });
  if (!rate.allowed) {
    return successResponse(false, { reason: "rate_limited" });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return successResponse(false, { reason: "invalid_json" });
  }

  const parsed = orderIntentSchema.safeParse(json);
  if (!parsed.success) {
    return successResponse(false, { reason: "invalid_body" });
  }

  const payload = parsed.data;
  if (payload.productSlug) {
    const product = getProductBySlug(payload.productSlug);
    if (!product) {
      console.warn("[order-intent] unknown product slug", payload.productSlug);
      return successResponse(false, { reason: "unknown_product" });
    }
  }

  try {
    console.info("[order-intent]", JSON.stringify(payload));
    const checks = getSupabaseRuntimeChecks();
    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return successResponse(false, {
        reason: "supabase_not_configured_or_invalid",
        details: {
          hasUrl: checks.hasUrl,
          hasServiceRoleKey: checks.hasServiceRoleKey,
          urlIsValid: checks.urlIsValid,
          urlHost: checks.urlHost,
          hadPathSuffix: checks.hadPathSuffix,
        },
      });
    }

    const { error } = await supabase.from("order_intents").insert([
      {
        product_slug: payload.productSlug ?? null,
        product_name: payload.productName ?? null,
        category: payload.category ?? null,
        price_pkr: payload.pricePkr ?? null,
        source_page: payload.sourcePage,
        event_timestamp: payload.timestamp,
        user_agent: payload.userAgent ?? null,
        // Let DB default manage created_at.
      },
    ]);

    if (error) {
      console.warn("[order-intent] supabase insert failed", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      return successResponse(false, {
        reason: "insert_failed",
        details: {
          code: error.code,
        },
      });
    }

    return successResponse(true);
  } catch (error) {
    captureServerError("api_order_intent_post_failed", error);
    console.warn("[order-intent] unexpected error", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return successResponse(false, { reason: "unexpected_error" });
  }
}
