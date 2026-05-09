"use client";

import { useState } from "react";

import { type OrderStatus, orderStatusLabel, orderStatuses } from "@/lib/orders";

type OrderStatusActionsProps = {
  orderId: string;
  currentStatus: OrderStatus;
};

export function OrderStatusActions({ orderId, currentStatus }: OrderStatusActionsProps) {
  const [pendingStatus, setPendingStatus] = useState<OrderStatus | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const updateStatus = async (nextStatus: OrderStatus) => {
    if (pendingStatus) return;
    setPendingStatus(nextStatus);
    setFeedback(null);

    try {
      const response = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (!response.ok) {
        setFeedback({ type: "error", message: "Could not update status." });
        setPendingStatus(null);
        return;
      }

      setFeedback({ type: "success", message: "Status updated." });
      window.setTimeout(() => window.location.reload(), 500);
    } catch {
      setFeedback({ type: "error", message: "Network error. Try again." });
      setPendingStatus(null);
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {orderStatuses.map((status) => {
          const isCurrent = status === currentStatus;
          const isPending = pendingStatus === status;
          return (
            <button
              key={status}
              type="button"
              disabled={Boolean(pendingStatus) || isCurrent}
              onClick={() => void updateStatus(status)}
              className={[
                "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                isCurrent
                  ? "bg-[#2F2624] text-[#F6F1EC]"
                  : "border border-[#3B2F2F]/16 bg-white/80 text-[#2E2323] hover:bg-[#F6EEE7]",
                (Boolean(pendingStatus) || isCurrent) && "cursor-not-allowed opacity-75",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {isPending ? "Updating..." : orderStatusLabel(status)}
            </button>
          );
        })}
      </div>
      {feedback ? (
        <p
          className={`text-[11px] ${
            feedback.type === "success" ? "text-[#2E6A41]" : "text-[#9A4C5A]"
          }`}
        >
          {feedback.message}
        </p>
      ) : null}
    </div>
  );
}
