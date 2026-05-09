"use client";

import { useState } from "react";

type CommunicationRow = {
  id: string;
  event_type: "order_confirmed" | "order_dispatched" | "order_delivered" | "order_cancelled";
  channel: "whatsapp" | "sms";
  delivery_status: "queued" | "sent" | "failed";
  recipient_phone: string | null;
  message_preview: string | null;
  sent_at: string | null;
  created_at: string;
};

type OrderCommunicationPanelProps = {
  orderId: string;
  communications: CommunicationRow[];
};

const eventButtons: Array<{ id: CommunicationRow["event_type"]; label: string }> = [
  { id: "order_confirmed", label: "Send Confirmation" },
  { id: "order_dispatched", label: "Send Dispatch Update" },
  { id: "order_delivered", label: "Send Delivered Update" },
  { id: "order_cancelled", label: "Send Cancelled Update" },
];

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-PK", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function labelForEvent(eventType: CommunicationRow["event_type"]): string {
  if (eventType === "order_confirmed") return "Order confirmed";
  if (eventType === "order_dispatched") return "Order dispatched";
  if (eventType === "order_delivered") return "Order delivered";
  return "Order cancelled";
}

export function OrderCommunicationPanel({ orderId, communications }: OrderCommunicationPanelProps) {
  const [loadingEvent, setLoadingEvent] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const sendEvent = async (eventType: CommunicationRow["event_type"]) => {
    if (loadingEvent) return;
    setLoadingEvent(eventType);
    setFeedback(null);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/communications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventType, channel: "whatsapp" }),
      });
      const result = (await response.json().catch(() => null)) as
        | { ok?: boolean; deliveryStatus?: string; error?: string }
        | null;
      if (!response.ok || !result?.ok) {
        setFeedback(result?.error || "Could not send update.");
        setLoadingEvent(null);
        return;
      }
      setFeedback(result.deliveryStatus === "sent" ? "Update sent." : "Update queued/failed. Check timeline.");
      window.setTimeout(() => window.location.reload(), 700);
    } catch {
      setFeedback("Network error while sending update.");
      setLoadingEvent(null);
    }
  };

  return (
    <section className="rounded-3xl border border-[#3B2F2F]/10 bg-white/90 p-5 sm:p-6">
      <h2 className="text-xl font-semibold text-[#1F1918]">Customer communication</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {eventButtons.map((button) => (
          <button
            key={button.id}
            type="button"
            onClick={() => void sendEvent(button.id)}
            disabled={Boolean(loadingEvent)}
            className="rounded-full border border-[#3B2F2F]/14 bg-[#F4EBE2] px-3.5 py-1.5 text-xs font-medium text-[#2E2323] hover:bg-[#EDE3D9] disabled:opacity-70"
          >
            {loadingEvent === button.id ? "Sending..." : button.label}
          </button>
        ))}
      </div>
      {feedback ? <p className="mt-2 text-sm text-[#3B2F2F]/78">{feedback}</p> : null}

      <div className="mt-4 space-y-3">
        {communications.length === 0 ? (
          <p className="text-sm text-[#3B2F2F]/72">No communication logs yet.</p>
        ) : (
          communications.map((entry) => (
            <article key={entry.id} className="rounded-2xl border border-[#3B2F2F]/10 bg-[#FCF7F2] p-3">
              <p className="text-sm font-medium text-[#2E2323]">
                {labelForEvent(entry.event_type)} • {entry.channel.toUpperCase()} • {entry.delivery_status}
              </p>
              <p className="mt-1 text-xs text-[#3B2F2F]/70">
                {formatDateTime(entry.sent_at ?? entry.created_at)} • {entry.recipient_phone ?? "No phone"}
              </p>
              {entry.message_preview ? (
                <p className="mt-1 text-sm text-[#3B2F2F]/80">{entry.message_preview}</p>
              ) : null}
            </article>
          ))
        )}
      </div>
    </section>
  );
}
