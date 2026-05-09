"use client";

import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");
  const [message, setMessage] = useState<string>("");

  const createOrder = async () => {
    if (loading) return;
    setLoading(true);
    setStatus("idle");
    setMessage("");

    try {
      if (!productSlug || productSlug === "unknown" || productSlug === "diagnostic-test") {
        setStatus("error");
        setMessage("This intent cannot be converted to an order.");
        return;
      }

      const parsedIntentTime = new Date(latestIntentTimestamp);
      const payload: Record<string, unknown> = {
        productSlug,
        productName,
        category,
        sourcePage,
        pricePkr,
        quantity: 1,
        notes: "Created from order intent review.",
      };
      if (!Number.isNaN(parsedIntentTime.getTime())) {
        payload.intentTimestamp = parsedIntentTime.toISOString();
      }

      const res = await fetch("/api/admin/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; orderId?: string; error?: string; warning?: string }
        | null;

      if (!res.ok) {
        setStatus("error");
        setMessage(json?.error || "Could not create order. Please retry.");
        return;
      }

      if (!json?.ok || !json.orderId) {
        setStatus("error");
        setMessage(json?.error || "Order API returned an unexpected response.");
        return;
      }

      setStatus("ok");
      setMessage(json.warning || "Order created successfully.");
      router.push(`/admin/orders?created=${encodeURIComponent(json.orderId)}&status=new_intent`);
      router.refresh();
    } catch {
      setStatus("error");
      setMessage("Network issue while creating order. Please retry.");
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
    <div className="space-y-1">
      <button
        type="button"
        onClick={createOrder}
        disabled={loading}
        className="rounded-full border border-[#2E2323]/14 bg-[#EFE4D8] px-3 py-1 text-xs font-medium text-[#2E2323] transition-colors hover:bg-[#E8DBCD] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {label}
      </button>
      {status !== "idle" && message ? (
        <p className={`text-[11px] ${status === "error" ? "text-[#9A4C5A]" : "text-[#2E6A41]"}`}>{message}</p>
      ) : null}
    </div>
  );
}
