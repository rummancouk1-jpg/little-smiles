import { NextResponse } from "next/server";
import { z } from "zod";

import { captureServerError } from "@/lib/error-observability";
import { checkRequestRateLimit } from "@/lib/request-rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const trackSchema = z.object({
  orderRef: z.string().min(6).max(36),
  phone: z.string().min(7).max(32),
});

function normalizePhone(value: string): string {
  return value.replace(/\s+/g, "").trim();
}

function normalizeOrderRef(value: string): string {
  return value.trim().toLowerCase();
}

export async function POST(request: Request) {
  const rate = checkRequestRateLimit({
    request,
    routeKey: "track_order",
    limit: 25,
    windowMs: 10 * 60 * 1000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many lookup attempts. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = trackSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Service unavailable" }, { status: 503 });
  }

  const phone = normalizePhone(parsed.data.phone);
  const orderRef = normalizeOrderRef(parsed.data.orderRef);

  const { data, error } = await supabase
    .from("orders")
    .select("id, product_name, status, updated_at, courier, tracking_id, total_pkr, customer_phone")
    .eq("customer_phone", phone)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    captureServerError("api_track_order_query_failed", new Error(error.message ?? "Could not lookup order"));
    return NextResponse.json({ ok: false, error: "Could not lookup order" }, { status: 500 });
  }

  const matched = (data ?? []).find((row) => row.id.toLowerCase().startsWith(orderRef));
  if (!matched) {
    return NextResponse.json({ ok: false, error: "No matching order found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    order: {
      id: matched.id,
      shortId: matched.id.slice(0, 8),
      productName: matched.product_name,
      status: matched.status,
      updatedAt: matched.updated_at,
      courier: matched.courier,
      trackingId: matched.tracking_id,
      totalPkr: matched.total_pkr,
    },
  });
}
