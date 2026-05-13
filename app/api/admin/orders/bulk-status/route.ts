import { NextResponse } from "next/server";
import { z } from "zod";

import { isAuthorizedAdminRequest } from "@/lib/admin-auth";
import { logAdminAudit } from "@/lib/admin-audit";
import { isOrderStatus } from "@/lib/orders";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const bulkStatusSchema = z.object({
  orderIds: z.array(z.string().uuid()).min(1).max(300),
  status: z.string().min(1),
  note: z.string().max(2000).optional(),
});

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

  const parsed = bulkStatusSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }
  if (!isOrderStatus(parsed.data.status)) {
    return NextResponse.json({ ok: false, error: "Invalid status" }, { status: 400 });
  }

  const uniqueOrderIds = Array.from(new Set(parsed.data.orderIds));
  const { data: currentRows, error: fetchError } = await supabase
    .from("orders")
    .select("id, status")
    .in("id", uniqueOrderIds);

  if (fetchError) {
    return NextResponse.json({ ok: false, error: "Could not fetch orders" }, { status: 500 });
  }

  const rows = currentRows ?? [];
  if (rows.length === 0) {
    return NextResponse.json({ ok: false, error: "No matching orders found" }, { status: 404 });
  }

  const now = new Date().toISOString();
  const idsToUpdate = rows.map((row) => row.id);

  // The status-change note belongs only in order_status_history (inserted
  // below). Writing it to orders.notes here would overwrite each order's
  // standing notes captured via PATCH /api/admin/orders/[orderId].
  const { error: updateError } = await supabase
    .from("orders")
    .update({
      status: parsed.data.status,
      updated_at: now,
    })
    .in("id", idsToUpdate);

  if (updateError) {
    await logAdminAudit(request, {
      action: "orders_bulk_status_failed",
      targetType: "order",
      metadata: { toStatus: parsed.data.status, totalOrders: idsToUpdate.length },
    });
    return NextResponse.json({ ok: false, error: "Could not update orders" }, { status: 500 });
  }

  const historyRows = rows.map((row) => ({
    order_id: row.id,
    from_status: row.status,
    to_status: parsed.data.status,
    note: parsed.data.note ?? null,
    changed_at: now,
  }));

  const { error: historyError } = await supabase.from("order_status_history").insert(historyRows);

  if (historyError) {
    await logAdminAudit(request, {
      action: "orders_bulk_status_history_failed",
      targetType: "order",
      metadata: { toStatus: parsed.data.status, totalOrders: idsToUpdate.length },
    });
    return NextResponse.json({
      ok: true,
      updated: idsToUpdate.length,
      warning: "Orders updated, history insert failed.",
    });
  }

  await logAdminAudit(request, {
    action: "orders_bulk_status_updated",
    targetType: "order",
    metadata: { toStatus: parsed.data.status, totalOrders: idsToUpdate.length },
  });
  return NextResponse.json({ ok: true, updated: idsToUpdate.length });
}
