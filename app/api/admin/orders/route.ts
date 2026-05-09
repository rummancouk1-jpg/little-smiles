import { NextResponse } from "next/server";
import { z } from "zod";

import { isAuthorizedAdminRequest } from "@/lib/admin-auth";
import { logAdminAudit } from "@/lib/admin-audit";
import { captureServerError } from "@/lib/error-observability";
import { isOrderStatus } from "@/lib/orders";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const paymentMethodValues = ["cod", "bank_transfer", "easypaisa", "jazzcash", "other"] as const;
const paidStatusValues = ["unpaid", "partial", "paid"] as const;

const createOrderSchema = z.object({
  sourceIntentId: z.string().uuid().optional(),
  productSlug: z.string().min(1).max(200),
  productName: z.string().min(1).max(200),
  category: z.string().min(1).max(120),
  pricePkr: z.number().int().min(0).max(1_000_000),
  quantity: z.number().int().min(1).max(99).default(1),
  customerName: z.string().min(1).max(120).optional(),
  customerPhone: z.string().min(7).max(32).optional(),
  customerCity: z.string().min(1).max(120).optional(),
  addressNote: z.string().max(500).optional(),
  deliveryFeePkr: z.number().int().min(0).max(100_000).optional(),
  courier: z.string().max(120).optional(),
  trackingId: z.string().max(120).optional(),
  paymentMethod: z.enum(paymentMethodValues).optional(),
  paidStatus: z.enum(paidStatusValues).optional(),
  sourcePage: z.string().min(1).max(240).optional(),
  intentTimestamp: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
});

function normalizePhone(value: string): string {
  return value.replace(/\s+/g, "").trim();
}

export async function GET(request: Request) {
  if (!isAuthorizedAdminRequest(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 503 });
  }

  const url = new URL(request.url);
  const statusFilter = url.searchParams.get("status");
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? "200"), 1), 1000);

  const query = supabase.from("orders").select("*").order("updated_at", { ascending: false }).limit(limit);

  if (statusFilter && isOrderStatus(statusFilter)) {
    query.eq("status", statusFilter);
  }

  const { data, error } = await query;
  if (error) {
    captureServerError("api_admin_orders_get_failed", new Error(error.message ?? "Could not fetch orders"));
    return NextResponse.json({ ok: false, error: "Could not fetch orders" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, orders: data ?? [] });
}

export async function POST(request: Request) {
  if (!isAuthorizedAdminRequest(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 503 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createOrderSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  const payload = parsed.data;
  const now = new Date().toISOString();
  const deliveryFee = payload.deliveryFeePkr ?? 0;
  const totalPkr = payload.pricePkr * payload.quantity + deliveryFee;
  const normalizedPhone = payload.customerPhone ? normalizePhone(payload.customerPhone) : null;
  let customerId: string | null = null;

  if (normalizedPhone && payload.customerName) {
    const { data: customerRow, error: customerUpsertError } = await supabase
      .from("customers")
      .upsert(
        [
          {
            phone: normalizedPhone,
            full_name: payload.customerName,
            city: payload.customerCity ?? null,
            address_note: payload.addressNote ?? null,
            updated_at: now,
          },
        ],
        { onConflict: "phone" },
      )
      .select("id")
      .single();

    if (!customerUpsertError && customerRow) {
      customerId = customerRow.id;
    }
  }

  const { data: inserted, error: insertError } = await supabase
    .from("orders")
    .insert([
      {
        customer_id: customerId,
        source_intent_id: payload.sourceIntentId ?? null,
        product_slug: payload.productSlug,
        product_name: payload.productName,
        category: payload.category,
        price_pkr: payload.pricePkr,
        quantity: payload.quantity,
        status: "new_intent",
        customer_name: payload.customerName ?? null,
        customer_phone: normalizedPhone,
        customer_city: payload.customerCity ?? null,
        address_note: payload.addressNote ?? null,
        delivery_fee_pkr: deliveryFee,
        total_pkr: totalPkr,
        courier: payload.courier ?? null,
        tracking_id: payload.trackingId ?? null,
        payment_method: payload.paymentMethod ?? "cod",
        paid_status: payload.paidStatus ?? "unpaid",
        details_completed_at: null,
        source_page: payload.sourcePage ?? null,
        intent_timestamp: payload.intentTimestamp ?? null,
        notes: payload.notes ?? null,
        created_at: now,
        updated_at: now,
      },
    ])
    .select("id")
    .single();

  if (insertError || !inserted) {
    captureServerError("api_admin_orders_create_failed", new Error(insertError?.message ?? "Could not create order"), {
      productSlug: payload.productSlug,
    });
    await logAdminAudit(request, {
      action: "order_create_failed",
      targetType: "order",
      metadata: { productSlug: payload.productSlug },
    });
    return NextResponse.json({ ok: false, error: "Could not create order" }, { status: 500 });
  }

  const { error: historyError } = await supabase.from("order_status_history").insert([
    {
      order_id: inserted.id,
      from_status: null,
      to_status: "new_intent",
      note: "Order created from admin/API.",
      changed_at: now,
    },
  ]);

  if (historyError) {
    captureServerError("api_admin_orders_history_insert_failed", new Error(historyError.message ?? "History insert failed"), {
      orderId: inserted.id,
    });
    await logAdminAudit(request, {
      action: "order_created_history_failed",
      targetType: "order",
      targetId: inserted.id,
      metadata: { productSlug: payload.productSlug },
    });
    return NextResponse.json(
      { ok: true, orderId: inserted.id, warning: "Order created, history insert failed." },
      { status: 200 },
    );
  }

  await logAdminAudit(request, {
    action: "order_created",
    targetType: "order",
    targetId: inserted.id,
    metadata: {
      productSlug: payload.productSlug,
      quantity: payload.quantity,
      pricePkr: payload.pricePkr,
      totalPkr,
    },
  });
  return NextResponse.json({ ok: true, orderId: inserted.id });
}
