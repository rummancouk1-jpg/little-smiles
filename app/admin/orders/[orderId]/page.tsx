import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AdminLogoutButton } from "@/components/admin/admin-logout-button";
import { OrderCommunicationPanel } from "@/components/admin/order-communication-panel";
import { OrderDetailForm } from "@/components/admin/order-detail-form";
import { getAdminSessionFromPage } from "@/lib/admin-auth";
import { adminConfigHelpText, isAdminAuthConfigured } from "@/lib/admin-runtime";
import { orderStatusLabel, type OrderStatus } from "@/lib/orders";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

type RouteProps = {
  params: Promise<{ orderId: string }>;
};

type OrderCommunicationRow = {
  id: string;
  event_type: "order_confirmed" | "order_dispatched" | "order_delivered" | "order_cancelled";
  channel: "whatsapp" | "sms";
  delivery_status: "queued" | "sent" | "failed";
  recipient_phone: string | null;
  message_preview: string | null;
  sent_at: string | null;
  created_at: string;
  provider_response?: Record<string, unknown> | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

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

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({ params }: RouteProps) {
  if (!isAdminAuthConfigured()) {
    return (
      <main className="min-h-screen bg-[#FDF8F4] px-5 py-10 sm:px-6 lg:px-8">
        <section className="mx-auto max-w-3xl rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-7 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-9">
          <h1 className="text-3xl font-semibold tracking-tight text-[#1F1918]">Admin Locked</h1>
          <p className="mt-3 text-sm leading-relaxed text-[#3B2F2F]/72">
            {adminConfigHelpText()}
          </p>
        </section>
      </main>
    );
  }

  const session = await getAdminSessionFromPage();
  if (!session) {
    const { orderId } = await params;
    redirect(`/admin/login?next=${encodeURIComponent(`/admin/orders/${orderId}`)}`);
  }

  const { orderId } = await params;
  const supabase = getSupabaseAdminClient();
  if (!supabase) notFound();

  const { data: order, error } = await supabase.from("orders").select("*").eq("id", orderId).single();
  if (error || !order) notFound();

  const { data: history } = await supabase
    .from("order_status_history")
    .select("id, from_status, to_status, note, changed_at")
    .eq("order_id", orderId)
    .order("changed_at", { ascending: false })
    .limit(40);
  const { data: communications } = await supabase
    .from("order_communications")
    .select(
      "id, event_type, channel, delivery_status, recipient_phone, message_preview, sent_at, created_at, provider_response",
    )
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
    .limit(40);

  const providerMode = process.env.ORDER_NOTIFICATION_PROVIDER?.trim().toLowerCase() || "simulated";
  const hasWebhookUrl = Boolean(process.env.ORDER_NOTIFICATION_WEBHOOK_URL?.trim());
  const hasTwilioSid = Boolean(process.env.TWILIO_ACCOUNT_SID?.trim());
  const hasTwilioToken = Boolean(process.env.TWILIO_AUTH_TOKEN?.trim());
  const hasTwilioSmsFrom = Boolean(process.env.TWILIO_SMS_FROM?.trim());
  const hasTwilioWhatsappFrom = Boolean(process.env.TWILIO_WHATSAPP_FROM?.trim());
  const latestCommunication = ((communications ?? [])[0] ?? null) as OrderCommunicationRow | null;
  const latestProviderResponse = asRecord(latestCommunication?.provider_response ?? null);

  return (
    <main className="min-h-screen bg-[#FDF8F4] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <section className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-5 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#3B2F2F]/50">Private Admin</p>
              <p className="mt-1 text-xs text-[#3B2F2F]/65">Signed in as {session.actorLabel}</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#1F1918] sm:text-4xl">
                Order Details
              </h1>
              <p className="mt-2 text-sm text-[#3B2F2F]/74">
                #{order.id.slice(0, 8)} • {order.product_name} • {orderStatusLabel(order.status as OrderStatus)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/admin/notifications?status=failed&range=30d"
                className="rounded-full border border-[#3B2F2F]/14 bg-[#F1E7DE] px-3.5 py-1.5 text-xs font-medium text-[#2E2323] hover:bg-[#E9DDD2]"
              >
                Notifications
              </Link>
              <Link
                href="/admin/orders"
                className="rounded-full border border-[#3B2F2F]/14 bg-[#EEE4DB] px-3.5 py-1.5 text-xs font-medium text-[#2E2323] hover:bg-[#E7DBD1]"
              >
                Back to Orders
              </Link>
              <AdminLogoutButton />
            </div>
          </div>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <article className="rounded-2xl border border-[#3B2F2F]/10 bg-white/85 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-[#3B2F2F]/55">Item value</p>
            <p className="mt-2 text-xl font-semibold text-[#1F1918]">{formatPkr(order.price_pkr * order.quantity)}</p>
          </article>
          <article className="rounded-2xl border border-[#3B2F2F]/10 bg-white/85 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-[#3B2F2F]/55">Delivery fee</p>
            <p className="mt-2 text-xl font-semibold text-[#1F1918]">{formatPkr(order.delivery_fee_pkr ?? 0)}</p>
          </article>
          <article className="rounded-2xl border border-[#3B2F2F]/10 bg-white/85 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-[#3B2F2F]/55">Total</p>
            <p className="mt-2 text-xl font-semibold text-[#1F1918]">{formatPkr(order.total_pkr ?? 0)}</p>
          </article>
          <article className="rounded-2xl border border-[#3B2F2F]/10 bg-white/85 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-[#3B2F2F]/55">Last update</p>
            <p className="mt-2 text-base font-semibold text-[#1F1918]">{formatDateTime(order.updated_at)}</p>
          </article>
        </div>

        <OrderDetailForm
          orderId={order.id}
          initialValues={{
            pricePkr: order.price_pkr ?? 0,
            quantity: order.quantity ?? 1,
            customerName: order.customer_name ?? "",
            customerPhone: order.customer_phone ?? "",
            customerCity: order.customer_city ?? "",
            addressNote: order.address_note ?? "",
            deliveryFeePkr: order.delivery_fee_pkr ?? 0,
            courier: order.courier ?? "",
            trackingId: order.tracking_id ?? "",
            paymentMethod: order.payment_method ?? "",
            paidStatus: order.paid_status ?? "unpaid",
            notes: order.notes ?? "",
          }}
        />

        <OrderCommunicationPanel
          orderId={order.id}
          communications={(communications ?? []) as OrderCommunicationRow[]}
        />

        <section className="rounded-3xl border border-[#3B2F2F]/10 bg-white/90 p-5 sm:p-6">
          <h2 className="text-xl font-semibold text-[#1F1918]">Provider health</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <article className="rounded-2xl border border-[#3B2F2F]/10 bg-[#FCF7F2] p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-[#3B2F2F]/58">Provider mode</p>
              <p className="mt-1 text-sm font-medium text-[#2E2323]">{providerMode}</p>
            </article>
            <article className="rounded-2xl border border-[#3B2F2F]/10 bg-[#FCF7F2] p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-[#3B2F2F]/58">Twilio config</p>
              <p className="mt-1 text-sm text-[#2E2323]">
                SID: {hasTwilioSid ? "Yes" : "No"} • Token: {hasTwilioToken ? "Yes" : "No"}
              </p>
              <p className="mt-1 text-sm text-[#2E2323]">
                SMS From: {hasTwilioSmsFrom ? "Yes" : "No"} • WhatsApp From: {hasTwilioWhatsappFrom ? "Yes" : "No"}
              </p>
            </article>
            <article className="rounded-2xl border border-[#3B2F2F]/10 bg-[#FCF7F2] p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-[#3B2F2F]/58">Webhook configured</p>
              <p className="mt-1 text-sm font-medium text-[#2E2323]">{hasWebhookUrl ? "Yes" : "No"}</p>
            </article>
          </div>
          <div className="mt-3 rounded-2xl border border-[#3B2F2F]/10 bg-[#FCF7F2] p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-[#3B2F2F]/58">Latest send result</p>
            {latestCommunication ? (
              <>
                <p className="mt-1 text-sm text-[#2E2323]">
                  {latestCommunication.event_type} • {latestCommunication.channel.toUpperCase()} •{" "}
                  {latestCommunication.delivery_status}
                </p>
                <p className="mt-1 text-xs text-[#3B2F2F]/70">
                  {formatDateTime(latestCommunication.sent_at ?? latestCommunication.created_at)}
                </p>
                <p className="mt-1 text-xs text-[#3B2F2F]/74">
                  Provider: {String(latestProviderResponse?.provider ?? "unknown")}
                  {latestProviderResponse?.status ? ` • Status: ${String(latestProviderResponse.status)}` : ""}
                  {latestProviderResponse?.error ? ` • Error: ${String(latestProviderResponse.error)}` : ""}
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm text-[#3B2F2F]/72">No sends yet for this order.</p>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-[#3B2F2F]/10 bg-white/90 p-5 sm:p-6">
          <h2 className="text-xl font-semibold text-[#1F1918]">Status timeline</h2>
          <div className="mt-4 space-y-3">
            {(history ?? []).length === 0 ? (
              <p className="text-sm text-[#3B2F2F]/72">No status changes yet.</p>
            ) : (
              (history ?? []).map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-[#3B2F2F]/10 bg-[#FCF7F2] p-3">
                  <p className="text-sm font-medium text-[#2E2323]">
                    {entry.from_status ? orderStatusLabel(entry.from_status as OrderStatus) : "Created"} {"->"}{" "}
                    {orderStatusLabel(entry.to_status as OrderStatus)}
                  </p>
                  <p className="mt-1 text-xs text-[#3B2F2F]/70">{formatDateTime(entry.changed_at)}</p>
                  {entry.note ? <p className="mt-1 text-sm text-[#3B2F2F]/80">{entry.note}</p> : null}
                </div>
              ))
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
