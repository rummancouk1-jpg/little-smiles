"use client";

import { useState } from "react";

type CreateOrderFromIntentButtonProps = {
  productSlug: string;
  productName: string;
  category: string;
  pricePkr: number;
  sourcePage: string;
  latestIntentTimestamp: string;
};

export function CreateOrderFromIntentButton({
  productSlug,
  productName,
  category,
  pricePkr,
  sourcePage,
  latestIntentTimestamp,
}: CreateOrderFromIntentButtonProps) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");

  const createOrder = async () => {
    if (loading) return;
    setLoading(true);
    setStatus("idle");

    try {
      const res = await fetch("/api/admin/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productSlug,
          productName,
          category,
          pricePkr,
          quantity: 1,
          sourcePage,
          intentTimestamp: latestIntentTimestamp,
          notes: "Created from order intent review.",
        }),
      });

      if (!res.ok) {
        setStatus("error");
        return;
      }

      setStatus("ok");
      window.location.reload();
    } catch {
      setStatus("error");
    } finally {
      setLoading(false);
    }
  };

  const label = loading
    ? "Creating..."
    : status === "ok"
      ? "Created"
      : status === "error"
        ? "Retry"
        : "Create Order";

  return (
    <button
      type="button"
      onClick={createOrder}
      disabled={loading}
      className="rounded-full border border-[#2E2323]/14 bg-[#EFE4D8] px-3 py-1 text-xs font-medium text-[#2E2323] transition-colors hover:bg-[#E8DBCD] disabled:cursor-not-allowed disabled:opacity-70"
    >
      {label}
    </button>
  );
}
