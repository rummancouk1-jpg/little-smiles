"use client";

import Link from "next/link";
import { useState } from "react";

type NotificationRow = {
  id: string;
  order_id: string;
  event_type: "order_confirmed" | "order_dispatched" | "order_delivered" | "order_cancelled";
  channel: "whatsapp" | "sms";
  recipient_phone: string | null;
  delivery_status: "queued" | "sent" | "failed";
  retry_count: number;
  max_retries: number;
  next_retry_at: string | null;
  last_error: string | null;
  created_at: string;
  sent_at: string | null;
};

type NotificationsTableProps = {
  rows: NotificationRow[];
};

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

export function NotificationsTable({ rows }: NotificationsTableProps) {
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [processingRetries, setProcessingRetries] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const retry = async (id: string) => {
    if (retryingId) return;
    setRetryingId(id);
    setFeedback(null);
    try {
      const response = await fetch(`/api/admin/communications/${id}/retry`, { method: "POST" });
      if (!response.ok) {
        setFeedback("Retry failed. Please try again.");
        setRetryingId(null);
        return;
      }
      setFeedback("Retry triggered.");
      window.setTimeout(() => window.location.reload(), 650);
    } catch {
      setFeedback("Network error during retry.");
      setRetryingId(null);
    }
  };

  const runAutoRetry = async () => {
    if (processingRetries) return;
    setProcessingRetries(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/admin/communications/process-retries", { method: "POST" });
      const data = (await response.json().catch(() => null)) as
        | { ok?: boolean; attempted?: number; sent?: number; failed?: number; error?: string }
        | null;
      if (!response.ok || !data?.ok) {
        setFeedback(data?.error || "Could not process retries.");
        setProcessingRetries(false);
        return;
      }
      setFeedback(`Auto-retry done: attempted ${data.attempted ?? 0}, sent ${data.sent ?? 0}, failed ${data.failed ?? 0}.`);
      window.setTimeout(() => window.location.reload(), 900);
    } catch {
      setFeedback("Network error while running retries.");
      setProcessingRetries(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-3xl border border-[#3B2F2F]/10 bg-white/90">
      <div className="border-b border-[#3B2F2F]/8 bg-[#FCF6F1]/75 px-4 py-3">
        <button
          type="button"
          onClick={() => void runAutoRetry()}
          disabled={processingRetries}
          className="rounded-full border border-[#3B2F2F]/14 bg-[#F4EBE2] px-3 py-1.5 text-xs font-medium text-[#2E2323] hover:bg-[#EDE3D9] disabled:opacity-70"
        >
          {processingRetries ? "Processing retries..." : "Run auto-retry now"}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[#F7F0EA]/85 text-xs uppercase tracking-[0.08em] text-[#3B2F2F]/58">
            <tr>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Event</th>
              <th className="px-4 py-3">Channel</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Retries</th>
              <th className="px-4 py-3">Recipient</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-[#3B2F2F]/68" colSpan={8}>
                  No notification records found for this filter.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-[#3B2F2F]/8">
                  <td className="px-4 py-3 text-[#3B2F2F]/82">{formatDateTime(row.sent_at ?? row.created_at)}</td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/orders/${row.order_id}`} className="text-[#2E2323] underline underline-offset-2">
                      #{row.order_id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[#3B2F2F]/82">{row.event_type}</td>
                  <td className="px-4 py-3 text-[#3B2F2F]/82">{row.channel.toUpperCase()}</td>
                  <td className="px-4 py-3">
                    <span
                      className={[
                        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                        row.delivery_status === "failed"
                          ? "bg-[#F8E8EA] text-[#8A2F40]"
                          : row.delivery_status === "sent"
                            ? "bg-[#E7F4EA] text-[#2E6A41]"
                            : "bg-[#EFECE8] text-[#5A4B47]",
                      ].join(" ")}
                    >
                      {row.delivery_status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#3B2F2F]/72">
                    {row.retry_count}/{row.max_retries}
                    {row.next_retry_at ? (
                      <span className="block text-xs text-[#3B2F2F]/62">Next: {formatDateTime(row.next_retry_at)}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-[#3B2F2F]/72">{row.recipient_phone ?? "—"}</td>
                  <td className="px-4 py-3">
                    {row.delivery_status === "failed" ? (
                      <button
                        type="button"
                        disabled={retryingId === row.id}
                        onClick={() => void retry(row.id)}
                        className="rounded-full border border-[#3B2F2F]/14 bg-[#F4EBE2] px-2.5 py-1 text-xs font-medium text-[#2E2323] hover:bg-[#EDE3D9] disabled:opacity-70"
                      >
                        {retryingId === row.id ? "Retrying..." : "Retry"}
                      </button>
                    ) : (
                      <span className="text-xs text-[#3B2F2F]/62">—</span>
                    )}
                    {row.last_error ? (
                      <p className="mt-1 max-w-48 text-[11px] text-[#8A2F40]" title={row.last_error}>
                        {row.last_error.slice(0, 80)}
                        {row.last_error.length > 80 ? "..." : ""}
                      </p>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {feedback ? <p className="border-t border-[#3B2F2F]/8 px-4 py-2 text-xs text-[#3B2F2F]/75">{feedback}</p> : null}
    </section>
  );
}
