import { NextResponse } from "next/server";

import { isAuthorizedAdminRequest } from "@/lib/admin-auth";
import { logAdminAudit } from "@/lib/admin-audit";
import { captureServerError } from "@/lib/error-observability";
import { computeNextRetryAtIso, extractProviderError, sendWithConfiguredProvider } from "@/lib/order-communications";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

type RouteProps = {
  params: Promise<{ communicationId: string }>;
};

export async function POST(request: Request, { params }: RouteProps) {
  if (!isAuthorizedAdminRequest(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 503 });
  }

  const { communicationId } = await params;
  const { data: row, error } = await supabase
    .from("order_communications")
    .select("id, order_id, event_type, channel, recipient_phone, message_preview, retry_count, max_retries")
    .eq("id", communicationId)
    .single();
  if (error || !row) {
    return NextResponse.json({ ok: false, error: "Communication not found" }, { status: 404 });
  }

  if (row.retry_count >= row.max_retries) {
    return NextResponse.json({ ok: false, error: "Retry limit reached" }, { status: 400 });
  }

  const result = await sendWithConfiguredProvider({
    orderId: row.order_id,
    eventType: row.event_type,
    channel: row.channel,
    phone: row.recipient_phone,
    message: row.message_preview ?? "Little Smiles order update.",
  });

  const now = new Date().toISOString();
  const nextRetryCount = row.retry_count + 1;
  const { error: updateError } = await supabase
    .from("order_communications")
    .update({
      delivery_status: result.deliveryStatus,
      provider_response: result.providerResponse,
      retry_count: nextRetryCount,
      next_retry_at:
        result.deliveryStatus === "failed" && nextRetryCount < row.max_retries
          ? computeNextRetryAtIso(nextRetryCount)
          : null,
      last_error: result.deliveryStatus === "failed" ? extractProviderError(result.providerResponse) : null,
      sent_at: result.deliveryStatus === "sent" ? now : null,
    })
    .eq("id", communicationId);

  if (updateError) {
    captureServerError(
      "api_admin_communication_retry_update_failed",
      new Error(updateError.message ?? "Could not update communication retry"),
      { communicationId, orderId: row.order_id },
    );
    return NextResponse.json(
      { ok: false, error: "Communication retried but result could not be persisted" },
      { status: 500 },
    );
  }

  await logAdminAudit(request, {
    action: result.deliveryStatus === "sent" ? "order_communication_retry_sent" : "order_communication_retry_failed",
    targetType: "order_communication",
    targetId: communicationId,
    metadata: { orderId: row.order_id, eventType: row.event_type, channel: row.channel },
  });

  return NextResponse.json({
    ok: true,
    deliveryStatus: result.deliveryStatus,
  });
}
