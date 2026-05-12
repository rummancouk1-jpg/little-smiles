import { NextResponse } from "next/server";
import { z } from "zod";

import { isAuthorizedAdminRequest } from "@/lib/admin-auth";
import { logAdminAudit } from "@/lib/admin-audit";
import { captureServerError } from "@/lib/error-observability";
import { isOrderStatus } from "@/lib/orders";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const statusUpdateSchema = z.object({
  status: z.string().min(1),
  note: z.string().max(2000).optional(),
});

type RouteProps = {
  params: Promise<{ orderId: string }>;
};

export async function POST(request: Request, { params }: RouteProps) {
  if (!isAuthorizedAdminRequest(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { orderId } = await params;
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

  const parsed = statusUpdateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }
  if (!isOrderStatus(parsed.data.status)) {
    return NextResponse.json({ ok: false, error: "Invalid status" }, { status: 400 });
  }

  const { data: current, error: fetchError } = await supabase
    .from("orders")
    .select("status")
    .eq("id", orderId)
    .single();

  if (fetchError || !current) {
    return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });
  }

  const now = new Date().toISOString();
  // The status-change note belongs only in order_status_history (inserted
  // below). Writing it to orders.notes here would overwrite the order's
  // standing notes captured via PATCH /api/admin/orders/[orderId].
  const { error: updateError } = await supabase
    .from("orders")
    .update({
      status: parsed.data.status,
      updated_at: now,
    })
    .eq("id", orderId);

  if (updateError) {
    captureServerError(
      "api_admin_order_status_update_failed",
      new Error(updateError.message ?? "Could not update order status"),
      { orderId, fromStatus: current.status, toStatus: parsed.data.status },
    );
    await logAdminAudit(request, {
      action: "order_status_update_failed",
      targetType: "order",
      targetId: orderId,
      metadata: { fromStatus: current.status, toStatus: parsed.data.status },
    });
    return NextResponse.json({ ok: false, error: "Could not update order status" }, { status: 500 });
  }

  const { error: historyError } = await supabase.from("order_status_history").insert([
    {
      order_id: orderId,
      from_status: current.status,
      to_status: parsed.data.status,
      note: parsed.data.note ?? null,
      changed_at: now,
    },
  ]);

  if (historyError) {
    captureServerError(
      "api_admin_order_status_history_failed",
      new Error(historyError.message ?? "Status history insert failed"),
      { orderId, fromStatus: current.status, toStatus: parsed.data.status },
    );
    await logAdminAudit(request, {
      action: "order_status_updated_history_failed",
      targetType: "order",
      targetId: orderId,
      metadata: { fromStatus: current.status, toStatus: parsed.data.status },
    });
    return NextResponse.json({ ok: true, warning: "Status updated, history insert failed." });
  }

  await logAdminAudit(request, {
    action: "order_status_updated",
    targetType: "order",
    targetId: orderId,
    metadata: { fromStatus: current.status, toStatus: parsed.data.status },
  });
  return NextResponse.json({ ok: true });
}
