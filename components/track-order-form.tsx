"use client";

import { useState } from "react";
import type { FormEvent } from "react";

type TrackOrderResult = {
  shortId: string;
  productName: string;
  status: string;
  updatedAt: string;
  courier: string | null;
  trackingId: string | null;
  totalPkr: number;
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

function formatPkr(value: number): string {
  return `Rs. ${value.toLocaleString("en-PK")}`;
}

export function TrackOrderForm() {
  const [orderRef, setOrderRef] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TrackOrderResult | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch("/api/track-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderRef, phone }),
      });
      const data = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string; order?: TrackOrderResult }
        | null;
      if (!response.ok || !data?.ok || !data.order) {
        setError(data?.error || "Order not found.");
        setLoading(false);
        return;
      }
      setResult(data.order);
      setLoading(false);
    } catch {
      setError("Could not check order status right now.");
      setLoading(false);
    }
  };

  return (
    <section className="rounded-3xl border border-[#3B2F2F]/10 bg-white/90 p-6 sm:p-7">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-1">
          <label htmlFor="order-ref" className="text-sm font-medium text-[#2E2323]">
            Order ID (first 8 chars or full)
          </label>
          <input
            id="order-ref"
            value={orderRef}
            onChange={(event) => setOrderRef(event.target.value)}
            placeholder="e.g. a1b2c3d4"
            className="h-11 rounded-2xl border border-[#3B2F2F]/14 bg-white px-3 text-sm text-[#2E2323] outline-none focus-visible:ring-2 focus-visible:ring-[#2E2323]/20"
          />
        </div>
        <div className="grid gap-1">
          <label htmlFor="order-phone" className="text-sm font-medium text-[#2E2323]">
            Phone number used for order
          </label>
          <input
            id="order-phone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="03XXXXXXXXX"
            className="h-11 rounded-2xl border border-[#3B2F2F]/14 bg-white px-3 text-sm text-[#2E2323] outline-none focus-visible:ring-2 focus-visible:ring-[#2E2323]/20"
          />
        </div>
        <button
          type="submit"
          disabled={loading || orderRef.trim().length < 6 || phone.trim().length < 7}
          className="h-11 rounded-full bg-[#2F2624] px-6 text-sm font-medium text-[#F6F1EC] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? "Checking..." : "Track order"}
        </button>
      </form>

      {error ? <p className="mt-4 text-sm text-[#9A4C5A]">{error}</p> : null}

      {result ? (
        <article className="mt-5 rounded-2xl border border-[#3B2F2F]/10 bg-[#FCF7F2] p-4">
          <p className="text-sm font-semibold text-[#1F1918]">
            Order #{result.shortId} • {result.productName}
          </p>
          <p className="mt-2 text-sm text-[#3B2F2F]/80">Status: {result.status}</p>
          <p className="mt-1 text-sm text-[#3B2F2F]/80">Total: {formatPkr(result.totalPkr)}</p>
          <p className="mt-1 text-sm text-[#3B2F2F]/80">Last update: {formatDateTime(result.updatedAt)}</p>
          {result.courier ? <p className="mt-1 text-sm text-[#3B2F2F]/80">Courier: {result.courier}</p> : null}
          {result.trackingId ? (
            <p className="mt-1 text-sm text-[#3B2F2F]/80">Tracking ID: {result.trackingId}</p>
          ) : null}
        </article>
      ) : null}
    </section>
  );
}
