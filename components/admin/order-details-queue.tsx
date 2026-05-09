"use client";

import Link from "next/link";
import { useState } from "react";

type QueueOrder = {
  id: string;
  product_name: string;
  customer_name: string | null;
  customer_phone: string | null;
  created_at: string;
};

type OrderDetailsQueueProps = {
  orders: QueueOrder[];
};

function formatDateTime(value: string): string {
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

export function OrderDetailsQueue({ orders }: OrderDetailsQueueProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const markComplete = async (order: QueueOrder) => {
    if (loadingId) return;
    if (!order.customer_name || !order.customer_phone) {
      setFeedback("Fill customer name and phone first, then mark complete.");
      return;
    }
    setLoadingId(order.id);
    setFeedback(null);
    try {
      const response = await fetch(`/api/admin/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: order.customer_name,
          customerPhone: order.customer_phone,
          markDetailsComplete: true,
        }),
      });
      if (!response.ok) {
        setFeedback("Could not mark complete. Please retry.");
        setLoadingId(null);
        return;
      }
      window.location.reload();
    } catch {
      setFeedback("Network issue. Please retry.");
      setLoadingId(null);
    }
  };

  if (orders.length === 0) return null;

  return (
    <section className="rounded-3xl border border-[#3B2F2F]/10 bg-white/90 p-5 sm:p-6">
      <h2 className="text-lg font-semibold text-[#1F1918]">Details completion queue</h2>
      <p className="mt-1 text-sm text-[#3B2F2F]/72">Oldest incomplete orders first.</p>
      <div className="mt-4 space-y-3">
        {orders.map((order) => (
          <article key={order.id} className="rounded-2xl border border-[#3B2F2F]/10 bg-[#FCF7F2] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-[#2E2323]">
                  {order.product_name} #{order.id.slice(0, 8)}
                </p>
                <p className="mt-1 text-xs text-[#3B2F2F]/70">
                  {formatDateTime(order.created_at)} • {order.customer_name || "Missing name"} •{" "}
                  {order.customer_phone || "Missing phone"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/admin/orders/${order.id}`}
                  className="rounded-full border border-[#3B2F2F]/14 bg-white px-3 py-1.5 text-xs font-medium text-[#2E2323] hover:bg-[#F8F2EC]"
                >
                  Open
                </Link>
                <button
                  type="button"
                  disabled={loadingId === order.id}
                  onClick={() => void markComplete(order)}
                  className="rounded-full bg-[#2F2624] px-3 py-1.5 text-xs font-medium text-[#F6F1EC] disabled:opacity-70"
                >
                  {loadingId === order.id ? "Saving..." : "Mark complete"}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {feedback ? <p className="mt-3 text-sm text-[#9A4C5A]">{feedback}</p> : null}
    </section>
  );
}
