import { NextResponse } from "next/server";
import { z } from "zod";

import { isAuthorizedAdminRequest } from "@/lib/admin-auth";
import { logAdminAudit } from "@/lib/admin-audit";
import { isOrderStatus, type OrderStatus } from "@/lib/orders";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const bulkSetStatusSchema = z.object({
  updates: z
    .array(
      z.object({
        orderId: z.string().uuid(),
        status: z.string().min(1),
      }),
    )
    .min(1)
    .max(300),
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

  const parsed = bulkSetStatusSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  const updates = parsed.data.updates;
  for (const update of updates) {
    if (!isOrderStatus(update.status)) {
      return NextResponse.json({ ok: false, error: "Invalid status in updates" }, { status: 400 });
    }
  }
  const typedUpdates: { orderId: string; status: OrderStatus }[] = updates.map((update) => ({
    orderId: update.orderId,
    status: update.status as OrderStatus,
  }));

  const orderIds = Array.from(new Set(typedUpdates.map((u) => u.orderId)));
  const { data: currentRows, error: fetchError } = await supabase
    .from("orders")
    .select("id, status")
    .in("id", orderIds);

  if (fetchError) {
    return NextResponse.json({ ok: false, error: "Could not fetch orders" }, { status: 500 });
  }

  const currentById = new Map((currentRows ?? []).map((row) => [row.id, row.status]));
  const now = new Date().toISOString();

  const tasks = typedUpdates.map(async (update) => {
    const fromStatus = currentById.get(update.orderId);
    if (!fromStatus) return { ok: false as const, orderId: update.orderId };

    const { error: updateError } = await supabase
      .from("orders")
      .update({
        status: update.status,
        updated_at: now,
      })
      .eq("id", update.orderId);

    if (updateError) return { ok: false as const, orderId: update.orderId };

    const { error: historyError } = await supabase.from("order_status_history").insert([
      {
        order_id: update.orderId,
        from_status: fromStatus,
        to_status: update.status,
        note: parsed.data.note ?? "Bulk status set from admin console.",
        changed_at: now,
      },
    ]);

    if (historyError) return { ok: false as const, orderId: update.orderId };
    return { ok: true as const, orderId: update.orderId };
  });

  const results = await Promise.all(tasks);
  const updated = results.filter((r) => r.ok).length;
  await logAdminAudit(request, {
    action: "orders_bulk_status_set",
    targetType: "order",
    metadata: {
      updated,
      failed: results.length - updated,
      totalRequested: typedUpdates.length,
    },
  });

  return NextResponse.json({
    ok: true,
    updated,
    failed: results.length - updated,
  });
}
