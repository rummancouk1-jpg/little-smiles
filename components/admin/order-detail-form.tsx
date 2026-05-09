"use client";

import { useState } from "react";

type OrderDetailFormProps = {
  orderId: string;
  initialValues: {
    pricePkr: number;
    quantity: number;
    customerName: string;
    customerPhone: string;
    customerCity: string;
    addressNote: string;
    deliveryFeePkr: number;
    courier: string;
    trackingId: string;
    paymentMethod: string;
    paidStatus: string;
    notes: string;
  };
};

type SaveState = "idle" | "saving" | "success" | "error";

const paymentMethodOptions = [
  { value: "", label: "Select payment method" },
  { value: "cod", label: "Cash on Delivery" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "easypaisa", label: "Easypaisa" },
  { value: "jazzcash", label: "JazzCash" },
  { value: "other", label: "Other" },
];

const paidStatusOptions = [
  { value: "unpaid", label: "Unpaid" },
  { value: "partial", label: "Partial Paid" },
  { value: "paid", label: "Paid" },
];

export function OrderDetailForm({ orderId, initialValues }: OrderDetailFormProps) {
  const [form, setForm] = useState(initialValues);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const computedItemTotal = Math.max(0, form.pricePkr) * Math.max(1, form.quantity);
  const computedGrandTotal = computedItemTotal + Math.max(0, form.deliveryFeePkr);

  const formatPkr = (value: number) => `Rs. ${value.toLocaleString("en-PK")}`;

  const save = async () => {
    if (saveState === "saving") return;
    setSaveState("saving");
    try {
      const response = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pricePkr: Number.isFinite(form.pricePkr) ? form.pricePkr : 0,
          quantity: Number.isFinite(form.quantity) ? form.quantity : 1,
          customerName: form.customerName || undefined,
          customerPhone: form.customerPhone || undefined,
          customerCity: form.customerCity || undefined,
          addressNote: form.addressNote || undefined,
          deliveryFeePkr: Number.isFinite(form.deliveryFeePkr) ? form.deliveryFeePkr : 0,
          courier: form.courier || undefined,
          trackingId: form.trackingId || undefined,
          paymentMethod: form.paymentMethod || null,
          paidStatus: form.paidStatus || "unpaid",
          notes: form.notes || undefined,
        }),
      });
      if (!response.ok) {
        setSaveState("error");
        return;
      }
      setSaveState("success");
      window.setTimeout(() => {
        window.location.reload();
      }, 600);
    } catch {
      setSaveState("error");
    }
  };

  return (
    <section className="rounded-3xl border border-[#3B2F2F]/10 bg-white/90 p-5 sm:p-6">
      <h2 className="text-xl font-semibold text-[#1F1918]">Customer & Fulfillment</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="grid gap-1 text-sm text-[#2E2323]">
          Unit price (PKR)
          <input
            type="number"
            min={0}
            value={form.pricePkr}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, pricePkr: Number.parseInt(event.target.value || "0", 10) || 0 }))
            }
            className="h-10 rounded-xl border border-[#3B2F2F]/14 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#3B2F2F]/20"
          />
        </label>
        <label className="grid gap-1 text-sm text-[#2E2323]">
          Quantity
          <input
            type="number"
            min={1}
            max={99}
            value={form.quantity}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, quantity: Number.parseInt(event.target.value || "1", 10) || 1 }))
            }
            className="h-10 rounded-xl border border-[#3B2F2F]/14 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#3B2F2F]/20"
          />
        </label>
        <label className="grid gap-1 text-sm text-[#2E2323]">
          Customer name
          <input
            value={form.customerName}
            onChange={(event) => setForm((prev) => ({ ...prev, customerName: event.target.value }))}
            className="h-10 rounded-xl border border-[#3B2F2F]/14 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#3B2F2F]/20"
          />
        </label>
        <label className="grid gap-1 text-sm text-[#2E2323]">
          Customer phone
          <input
            value={form.customerPhone}
            onChange={(event) => setForm((prev) => ({ ...prev, customerPhone: event.target.value }))}
            className="h-10 rounded-xl border border-[#3B2F2F]/14 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#3B2F2F]/20"
          />
        </label>
        <label className="grid gap-1 text-sm text-[#2E2323]">
          City
          <input
            value={form.customerCity}
            onChange={(event) => setForm((prev) => ({ ...prev, customerCity: event.target.value }))}
            className="h-10 rounded-xl border border-[#3B2F2F]/14 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#3B2F2F]/20"
          />
        </label>
        <label className="grid gap-1 text-sm text-[#2E2323]">
          Delivery fee (PKR)
          <input
            type="number"
            min={0}
            value={form.deliveryFeePkr}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, deliveryFeePkr: Number.parseInt(event.target.value || "0", 10) || 0 }))
            }
            className="h-10 rounded-xl border border-[#3B2F2F]/14 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#3B2F2F]/20"
          />
        </label>
        <label className="grid gap-1 text-sm text-[#2E2323]">
          Courier
          <input
            value={form.courier}
            onChange={(event) => setForm((prev) => ({ ...prev, courier: event.target.value }))}
            className="h-10 rounded-xl border border-[#3B2F2F]/14 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#3B2F2F]/20"
          />
        </label>
        <label className="grid gap-1 text-sm text-[#2E2323]">
          Tracking ID
          <input
            value={form.trackingId}
            onChange={(event) => setForm((prev) => ({ ...prev, trackingId: event.target.value }))}
            className="h-10 rounded-xl border border-[#3B2F2F]/14 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#3B2F2F]/20"
          />
        </label>
        <label className="grid gap-1 text-sm text-[#2E2323]">
          Payment method
          <select
            value={form.paymentMethod}
            onChange={(event) => setForm((prev) => ({ ...prev, paymentMethod: event.target.value }))}
            className="h-10 rounded-xl border border-[#3B2F2F]/14 bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#3B2F2F]/20"
          >
            {paymentMethodOptions.map((option) => (
              <option key={option.value || "empty"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm text-[#2E2323]">
          Paid status
          <select
            value={form.paidStatus}
            onChange={(event) => setForm((prev) => ({ ...prev, paidStatus: event.target.value }))}
            className="h-10 rounded-xl border border-[#3B2F2F]/14 bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#3B2F2F]/20"
          >
            {paidStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="mt-4 grid gap-1 text-sm text-[#2E2323]">
        Address note
        <textarea
          value={form.addressNote}
          onChange={(event) => setForm((prev) => ({ ...prev, addressNote: event.target.value }))}
          className="min-h-20 rounded-2xl border border-[#3B2F2F]/14 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#3B2F2F]/20"
        />
      </label>

      <label className="mt-4 grid gap-1 text-sm text-[#2E2323]">
        Internal notes
        <textarea
          value={form.notes}
          onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
          className="min-h-24 rounded-2xl border border-[#3B2F2F]/14 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#3B2F2F]/20"
        />
      </label>

      <div className="mt-4 rounded-2xl border border-[#3B2F2F]/10 bg-[#FCF7F2] p-3 text-sm text-[#2E2323]">
        <p>
          Item total: <span className="font-semibold">{formatPkr(computedItemTotal)}</span>
        </p>
        <p className="mt-1">
          Grand total: <span className="font-semibold">{formatPkr(computedGrandTotal)}</span>
        </p>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saveState === "saving"}
          className="rounded-full bg-[#2F2624] px-4 py-2 text-sm font-medium text-[#F6F1EC] hover:bg-[#251E1D] disabled:opacity-70"
        >
          {saveState === "saving" ? "Saving..." : "Save details"}
        </button>
        {saveState === "success" ? <p className="text-sm text-[#2E6A41]">Saved.</p> : null}
        {saveState === "error" ? <p className="text-sm text-[#9A4C5A]">Could not save. Try again.</p> : null}
      </div>
    </section>
  );
}
