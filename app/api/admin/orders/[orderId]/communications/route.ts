import { NextResponse } from "next/server";
import { z } from "zod";

import { isAuthorizedAdminRequest } from "@/lib/admin-auth";
import { logAdminAudit } from "@/lib/admin-audit";
import { captureServerError } from "@/lib/error-observability";
import {
  buildTemplateMessage,
  computeNextRetryAtIso,
  extractProviderError,
  normalizePhone,
  orderCommunicationChannels,
  orderCommunicationEventTypes,
  sendWithConfiguredProvider,
} from "@/lib/order-communications";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const eventTypeValues = orderCommunicationEventTypes;
const channelValues = orderCommunicationChannels;

const sendCommunicationSchema = z.object({
  eventType: z.enum(eventTypeValues),
  channel: z.enum(channelValues).default("whatsapp"),
  idempotencyKey: z.string().max(180).optional(),
});

type RouteProps = {
  params: Promise<{ orderId: string }>;
};

export async function POST(request: Request, { params }: RouteProps) {
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

  const parsed = sendCommunicationSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, product_name, customer_phone, courier, tracking_id")
    .eq("id", orderId)
    .single();
  if (orderError || !order) {
    return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });
  }

  const eventType = parsed.data.eventType;
  const channel = parsed.data.channel;
  const idempotencyKey = parsed.data.idempotencyKey?.trim() || `${orderId}:${eventType}:${channel}`;
  const recipientPhone = normalizePhone(order.customer_phone);
  const message = buildTemplateMessage(eventType, order);
  const now = new Date().toISOString();
  const configuredMaxRetries = Number.parseInt(process.env.ORDER_COMMUNICATION_MAX_RETRIES ?? "2", 10);
  const maxRetries = Number.isFinite(configuredMaxRetries) && configuredMaxRetries >= 0 ? configuredMaxRetries : 2;

  const { data: existing } = await supabase
    .from("order_communications")
    .select("id, delivery_status")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ ok: true, communicationId: existing.id, deliveryStatus: existing.delivery_status });
  }

  const { data: created, error: createError } = await supabase
    .from("order_communications")
    .insert([
      {
        order_id: orderId,
        event_type: eventType,
        channel,
        recipient_phone: recipientPhone,
        message_preview: message,
        delivery_status: "queued",
        provider_response: null,
        idempotency_key: idempotencyKey,
        retry_count: 0,
        max_retries: maxRetries,
        next_retry_at: null,
        last_error: null,
        sent_at: null,
        created_at: now,
      },
    ])
    .select("id")
    .single();

  if (createError || !created) {
    captureServerError(
      "api_admin_order_communication_queue_failed",
      new Error(createError?.message ?? "Could not queue communication"),
      { orderId, eventType, channel },
    );
    await logAdminAudit(request, {
      action: "order_communication_queue_failed",
      targetType: "order",
      targetId: orderId,
      metadata: { eventType, channel },
    });
    return NextResponse.json({ ok: false, error: "Could not queue communication" }, { status: 500 });
  }

  const deliveryResult = await sendWithConfiguredProvider({
    orderId: order.id,
    eventType,
    channel,
    phone: recipientPhone,
    message,
  });
  const deliveryStatus = deliveryResult.deliveryStatus;
  const providerResponse = deliveryResult.providerResponse;

  const { error: deliveryPersistError } = await supabase
    .from("order_communications")
    .update({
      delivery_status: deliveryStatus,
      provider_response: providerResponse,
      retry_count: deliveryStatus === "failed" ? 1 : 0,
      next_retry_at: deliveryStatus === "failed" && maxRetries > 0 ? computeNextRetryAtIso(1) : null,
      last_error: deliveryStatus === "failed" ? extractProviderError(providerResponse) : null,
      sent_at: deliveryStatus === "sent" ? now : null,
    })
    .eq("id", created.id);

  if (deliveryPersistError) {
    captureServerError(
      "api_admin_order_communication_persist_failed",
      new Error(deliveryPersistError.message ?? "Could not persist communication delivery result"),
      { orderId, communicationId: created.id, eventType, channel },
    );
    await logAdminAudit(request, {
      action: "order_communication_persist_failed",
      targetType: "order_communication",
      targetId: created.id,
      metadata: { orderId, eventType, channel },
    });
    return NextResponse.json(
      { ok: false, error: "Communication was sent but result could not be persisted" },
      { status: 500 },
    );
  }

  await logAdminAudit(request, {
    action: deliveryStatus === "sent" ? "order_communication_sent" : "order_communication_failed",
    targetType: "order",
    targetId: orderId,
    metadata: { eventType, channel, communicationId: created.id },
  });

  return NextResponse.json({
    ok: true,
    communicationId: created.id,
    deliveryStatus,
  });
}
