import { NextResponse } from "next/server";
import { z } from "zod";

import { isAuthorizedAdminRequest } from "@/lib/admin-auth";
import { logAdminAudit } from "@/lib/admin-audit";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const paymentMethodValues = ["cod", "bank_transfer", "easypaisa", "jazzcash", "other"] as const;
const paidStatusValues = ["unpaid", "partial", "paid"] as const;

const updateOrderSchema = z.object({
  pricePkr: z.number().int().min(0).max(1_000_000).optional(),
  quantity: z.number().int().min(1).max(99).optional(),
  customerName: z.string().max(120).optional(),
  customerPhone: z.string().max(32).optional(),
  customerCity: z.string().max(120).optional(),
  addressNote: z.string().max(500).optional(),
  deliveryFeePkr: z.number().int().min(0).max(100_000).optional(),
  courier: z.string().max(120).optional(),
  trackingId: z.string().max(120).optional(),
  paymentMethod: z.enum(paymentMethodValues).nullable().optional(),
  paidStatus: z.enum(paidStatusValues).optional(),
  markDetailsComplete: z.boolean().optional(),
  notes: z.string().max(2000).optional(),
});

type RouteProps = {
  params: Promise<{ orderId: string }>;
};

function normalizePhone(value: string | undefined): string | null {
  if (!value) return null;
  const cleaned = value.replace(/\s+/g, "").trim();
  return cleaned.length > 0 ? cleaned : null;
}

export async function GET(request: Request, { params }: RouteProps) {
  if (!isAuthorizedAdminRequest(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 503 });
  }

  const { orderId } = await params;
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single();

  if (error || !data) {
    return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, order: data });
}

export async function PATCH(request: Request, { params }: RouteProps) {
  if (!isAuthorizedAdminRequest(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 503 });
  }

  const { orderId } = await params;
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateOrderSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  const { data: current, error: currentError } = await supabase
    .from("orders")
    .select(
      "id, price_pkr, quantity, customer_id, customer_name, customer_phone, customer_city, address_note, delivery_fee_pkr, total_pkr, courier, tracking_id, payment_method, paid_status, details_completed_at, notes",
    )
    .eq("id", orderId)
    .single();
  if (currentError || !current) {
    return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });
  }

  const payload = parsed.data;
  const now = new Date().toISOString();
  const normalizedPhone =
    payload.customerPhone === undefined ? current.customer_phone : normalizePhone(payload.customerPhone);
  const unitPrice = payload.pricePkr ?? current.price_pkr;
  const quantity = payload.quantity ?? current.quantity;
  const deliveryFee = payload.deliveryFeePkr ?? current.delivery_fee_pkr ?? 0;
  const totalPkr = unitPrice * quantity + deliveryFee;
  let customerId: string | null = current.customer_id;
  const customerName = payload.customerName === undefined ? (current.customer_name ?? "") : payload.customerName;
  const customerCity = payload.customerCity === undefined ? current.customer_city : payload.customerCity;
  const addressNote = payload.addressNote === undefined ? current.address_note : payload.addressNote;
  const courier = payload.courier === undefined ? current.courier : payload.courier;
  const trackingId = payload.trackingId === undefined ? current.tracking_id : payload.trackingId;
  const paymentMethod = payload.paymentMethod === undefined ? current.payment_method : payload.paymentMethod;
  const paidStatus = payload.paidStatus === undefined ? current.paid_status : payload.paidStatus;
  const notes = payload.notes === undefined ? current.notes : payload.notes;

  if (normalizedPhone && customerName.trim().length > 0) {
    const { data: customerRow } = await supabase
      .from("customers")
      .upsert(
        [
          {
            phone: normalizedPhone,
            full_name: customerName,
            city: customerCity ?? null,
            address_note: addressNote ?? null,
            updated_at: now,
          },
        ],
        { onConflict: "phone" },
      )
      .select("id")
      .single();
    customerId = customerRow?.id ?? null;
  }

  const hasRequiredDetails =
    Boolean(customerName.trim().length) && Boolean(normalizedPhone && normalizedPhone.length > 0);
  if (payload.markDetailsComplete && !hasRequiredDetails) {
    return NextResponse.json(
      { ok: false, error: "Customer name and phone are required before marking details complete" },
      { status: 400 },
    );
  }

  const detailsCompletedAt =
    payload.markDetailsComplete === undefined
      ? current.details_completed_at
      : payload.markDetailsComplete
        ? now
        : null;

  const updatePayload = {
    price_pkr: unitPrice,
    quantity,
    customer_id: customerId,
    customer_name: customerName || null,
    customer_phone: normalizedPhone,
    customer_city: customerCity ?? null,
    address_note: addressNote ?? null,
    delivery_fee_pkr: deliveryFee,
    total_pkr: totalPkr,
    courier: courier ?? null,
    tracking_id: trackingId ?? null,
    payment_method: paymentMethod ?? null,
    paid_status: paidStatus ?? "unpaid",
    details_completed_at: detailsCompletedAt,
    notes: notes ?? null,
    updated_at: now,
  };

  const { error: updateError } = await supabase.from("orders").update(updatePayload).eq("id", orderId);
  if (updateError) {
    await logAdminAudit(request, {
      action: "order_detail_update_failed",
      targetType: "order",
      targetId: orderId,
    });
    return NextResponse.json({ ok: false, error: "Could not update order details" }, { status: 500 });
  }

  await logAdminAudit(request, {
    action: "order_detail_updated",
    targetType: "order",
    targetId: orderId,
    metadata: {
      hasCustomerPhone: Boolean(normalizedPhone),
      paymentMethod: payload.paymentMethod ?? null,
      paidStatus: payload.paidStatus ?? "unpaid",
      pricePkr: unitPrice,
      quantity,
      totalPkr,
    },
  });

  return NextResponse.json({ ok: true });
}
