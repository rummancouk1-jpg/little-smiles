import { computeNextRetryAtIso, extractProviderError, sendWithConfiguredProvider } from "@/lib/order-communications";
import { captureServerError } from "@/lib/error-observability";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const DEFAULT_PROCESS_LIMIT = 30;

export type RetryRunSummary = {
  attempted: number;
  sent: number;
  failed: number;
};

export async function processDueCommunicationRetries(
  processLimit: number = DEFAULT_PROCESS_LIMIT,
): Promise<RetryRunSummary> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    throw new Error("Supabase not configured");
  }

  const now = new Date().toISOString();
  const { data: rows, error } = await supabase
    .from("order_communications")
    .select("id, order_id, event_type, channel, recipient_phone, message_preview, retry_count, max_retries")
    .eq("delivery_status", "failed")
    .lt("retry_count", 10)
    .lte("next_retry_at", now)
    .order("next_retry_at", { ascending: true })
    .limit(processLimit);

  if (error) {
    throw new Error("Could not load retries");
  }

  let attempted = 0;
  let sent = 0;
  let failed = 0;

  for (const row of rows ?? []) {
    if (row.retry_count >= row.max_retries) continue;
    attempted += 1;

    const result = await sendWithConfiguredProvider({
      orderId: row.order_id,
      eventType: row.event_type,
      channel: row.channel,
      phone: row.recipient_phone,
      message: row.message_preview ?? "Little Smiles order update.",
    });
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
      .eq("id", row.id);

    if (updateError) {
      captureServerError(
        "order_communication_retry_persist_failed",
        new Error(updateError.message ?? "Could not persist retry result"),
        { communicationId: row.id, orderId: row.order_id },
      );
      failed += 1;
      continue;
    }

    if (result.deliveryStatus === "sent") {
      sent += 1;
    } else {
      failed += 1;
    }
  }

  return { attempted, sent, failed };
}
