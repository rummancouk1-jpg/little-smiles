"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { type OrderStatus, orderStatusLabel, orderStatuses } from "@/lib/orders";
import { OrderStatusActions } from "@/components/admin/order-status-actions";

export type AdminOrderRow = {
  id: string;
  product_slug: string;
  product_name: string;
  category: string;
  price_pkr: number;
  quantity: number;
  customer_name: string | null;
  customer_phone: string | null;
  delivery_fee_pkr: number;
  total_pkr: number;
  paid_status: "unpaid" | "partial" | "paid";
  details_completed_at: string | null;
  status: OrderStatus;
  source_page: string | null;
  created_at: string;
  updated_at: string;
};

type OrdersTableProps = {
  orders: AdminOrderRow[];
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

function formatPkr(value: number): string {
  return `Rs. ${value.toLocaleString("en-PK")}`;
}

export function OrdersTable({ orders }: OrdersTableProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<OrderStatus>("contacted");
  const [isApplying, setIsApplying] = useState(false);
  const [pendingReloadTimer, setPendingReloadTimer] = useState<number | null>(null);
  const [undoSecondsLeft, setUndoSecondsLeft] = useState<number>(0);
  const [undoIntervalId, setUndoIntervalId] = useState<number | null>(null);
  const [undoPayload, setUndoPayload] = useState<{ orderId: string; status: OrderStatus }[] | null>(
    null,
  );
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
    actionLabel?: string;
  } | null>(null);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allSelected = orders.length > 0 && selectedIds.length === orders.length;

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleAll = () => {
    setSelectedIds(allSelected ? [] : orders.map((order) => order.id));
  };

  const applyBulkStatus = async () => {
    if (isApplying || selectedIds.length === 0) return;
    setIsApplying(true);
    setToast(null);

    try {
      const previousStatuses = orders
        .filter((order) => selectedIds.includes(order.id))
        .map((order) => ({
          orderId: order.id,
          status: order.status,
        }));

      const res = await fetch("/api/admin/orders/bulk-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderIds: selectedIds,
          status: bulkStatus,
          note: "Bulk status update from admin console.",
        }),
      });
      if (!res.ok) {
        setToast({ type: "error", message: "Bulk update failed. Please retry." });
        setIsApplying(false);
        return;
      }
      setToast({
        type: "success",
        message: `Updated ${selectedIds.length} order${selectedIds.length === 1 ? "" : "s"}.`,
        actionLabel: "Undo",
      });
      setUndoPayload(previousStatuses);
      setUndoSecondsLeft(10);
      if (undoIntervalId) {
        window.clearInterval(undoIntervalId);
      }
      const interval = window.setInterval(() => {
        setUndoSecondsLeft((prev) => {
          if (prev <= 1) {
            window.clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      setUndoIntervalId(interval);
      const timer = window.setTimeout(() => {
        window.location.reload();
      }, 10_000);
      setPendingReloadTimer(timer);
    } catch {
      setToast({ type: "error", message: "Network issue. Please try again." });
      setIsApplying(false);
    }
  };

  const undoBulkStatus = async () => {
    if (!undoPayload || isApplying) return;
    setIsApplying(true);
    if (pendingReloadTimer) {
      window.clearTimeout(pendingReloadTimer);
      setPendingReloadTimer(null);
    }
    if (undoIntervalId) {
      window.clearInterval(undoIntervalId);
      setUndoIntervalId(null);
    }

    try {
      const res = await fetch("/api/admin/orders/bulk-set-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: undoPayload,
          note: "Undo bulk status update from admin console.",
        }),
      });
      if (!res.ok) {
        setToast({ type: "error", message: "Undo failed. Please retry." });
        setIsApplying(false);
        return;
      }
      setToast({ type: "success", message: "Bulk update reverted." });
      setUndoSecondsLeft(0);
      window.setTimeout(() => window.location.reload(), 800);
    } catch {
      setToast({ type: "error", message: "Undo network error. Please retry." });
      setIsApplying(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-3xl border border-[#3B2F2F]/10 bg-white/90">
      <div className="border-b border-[#3B2F2F]/8 bg-[#FCF6F1]/75 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-[0.12em] text-[#3B2F2F]/58">
            Bulk actions
          </span>
          <select
            value={bulkStatus}
            onChange={(event) => setBulkStatus(event.target.value as OrderStatus)}
            className="h-9 rounded-full border border-[#3B2F2F]/14 bg-white px-3 text-xs font-medium text-[#2E2323] outline-none"
          >
            {orderStatuses.map((status) => (
              <option key={status} value={status}>
                {orderStatusLabel(status)}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={selectedIds.length === 0 || isApplying}
            onClick={() => void applyBulkStatus()}
            className="rounded-full bg-[#2F2624] px-3.5 py-1.5 text-xs font-medium text-[#F6F1EC] transition-colors hover:bg-[#251E1D] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isApplying ? "Applying..." : `Apply to selected (${selectedIds.length})`}
          </button>
        </div>
        {toast ? (
          <p
            className={`mt-2 text-xs ${
              toast.type === "success" ? "text-[#2E6A41]" : "text-[#9A4C5A]"
            }`}
          >
            {toast.message}
            {toast.actionLabel && undoPayload ? (
              <>
                {" "}
                <button
                  type="button"
                  onClick={() => void undoBulkStatus()}
                  className="font-semibold underline underline-offset-2"
                >
                  {toast.actionLabel}
                </button>
                {undoSecondsLeft > 0 ? ` (${undoSecondsLeft}s)` : ""}
              </>
            ) : null}
          </p>
        ) : null}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[#F7F0EA]/85 text-xs uppercase tracking-[0.08em] text-[#3B2F2F]/58">
            <tr>
              <th className="px-4 py-3">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all orders" />
              </th>
              <th className="px-4 py-3">Order ID</th>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Qty</th>
              <th className="px-4 py-3 text-right">Value</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Updated</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-[#3B2F2F]/68" colSpan={10}>
                  No orders found for this status filter.
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id} className="border-t border-[#3B2F2F]/8">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedSet.has(order.id)}
                      onChange={() => toggleOne(order.id)}
                      aria-label={`Select order ${order.id}`}
                    />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-[#2E2323]">{order.id.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-[#3B2F2F]/82">{order.product_name}</td>
                  <td className="px-4 py-3 text-[#3B2F2F]/82">{order.category}</td>
                  <td className="px-4 py-3 text-[#2E2323]">{orderStatusLabel(order.status)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-[#2E2323]">{order.quantity}</td>
                  <td className="px-4 py-3 text-right font-semibold text-[#2E2323]">{formatPkr(order.total_pkr)}</td>
                  <td className="px-4 py-3 text-[#3B2F2F]/72">{order.source_page ?? "—"}</td>
                  <td className="px-4 py-3 text-[#3B2F2F]/72">{formatDateTime(order.updated_at)}</td>
                  <td className="px-4 py-3">
                    <div className="space-y-2">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="inline-flex rounded-full border border-[#3B2F2F]/14 bg-[#F4EBE2] px-2.5 py-1 text-[11px] font-medium text-[#2E2323] hover:bg-[#EDE3D9]"
                      >
                        Open details
                      </Link>
                      <OrderStatusActions orderId={order.id} currentStatus={order.status} />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
