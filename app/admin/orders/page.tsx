import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminLogoutButton } from "@/components/admin/admin-logout-button";
import { OrderDetailsQueue } from "@/components/admin/order-details-queue";
import { OrdersTable, type AdminOrderRow } from "@/components/admin/orders-table";
import { getAdminSessionFromPage } from "@/lib/admin-auth";
import { adminConfigHelpText, isAdminAuthConfigured } from "@/lib/admin-runtime";
import { isOrderStatus, type OrderStatus, orderStatusLabel, orderStatuses } from "@/lib/orders";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function asSingle(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
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

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const statusFilter = asSingle(params.status);
  const missingCustomerFilter = asSingle(params.missingCustomer) === "1";
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

  const adminSession = await getAdminSessionFromPage();
  if (!adminSession) {
    const next = statusFilter ? `/admin/orders?status=${statusFilter}` : "/admin/orders";
    redirect(`/admin/login?next=${encodeURIComponent(next)}`);
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return (
      <main className="min-h-screen bg-[#FDF8F4] px-5 py-10 sm:px-6 lg:px-8">
        <section className="mx-auto max-w-3xl rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-7 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-9">
          <h1 className="text-3xl font-semibold tracking-tight text-[#1F1918]">
            Supabase Not Configured
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-[#3B2F2F]/72">
            Configure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` on the server.
          </p>
        </section>
      </main>
    );
  }

  const query = supabase
    .from("orders")
    .select(
      "id, product_slug, product_name, category, price_pkr, quantity, customer_name, customer_phone, delivery_fee_pkr, total_pkr, paid_status, details_completed_at, status, source_page, created_at, updated_at",
    )
    .order("updated_at", { ascending: false })
    .limit(500);

  if (statusFilter && isOrderStatus(statusFilter)) {
    query.eq("status", statusFilter);
  }
  if (missingCustomerFilter) {
    query.or("customer_name.is.null,customer_phone.is.null");
  }

  const { data, error } = await query;
  if (error) {
    return (
      <main className="min-h-screen bg-[#FDF8F4] px-5 py-10 sm:px-6 lg:px-8">
        <section className="mx-auto max-w-3xl rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-7 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-9">
          <h1 className="text-3xl font-semibold tracking-tight text-[#1F1918]">
            Orders table missing or unavailable
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-[#3B2F2F]/72">
            Create the orders schema first (see `supabase/orders-schema.sql`) and refresh.
          </p>
        </section>
      </main>
    );
  }

  const orders = (data ?? []) as AdminOrderRow[];
  const { count: failedCommunicationCount } = await supabase
    .from("order_communications")
    .select("id", { count: "exact", head: true })
    .eq("delivery_status", "failed");
  const statusCounts = Object.fromEntries(orderStatuses.map((status) => [status, 0])) as Record<
    OrderStatus,
    number
  >;
  let latestUpdate: string | null = null;

  for (const order of orders) {
    statusCounts[order.status] += 1;
    if (!latestUpdate || new Date(order.updated_at).getTime() > new Date(latestUpdate).getTime()) {
      latestUpdate = order.updated_at;
    }
  }

  const totalOpen =
    statusCounts.new_intent + statusCounts.contacted + statusCounts.confirmed + statusCounts.dispatched;
  const totalOrders = orders.length;
  const incompleteQueue = orders
    .filter((order) => !order.details_completed_at)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .slice(0, 12)
    .map((order) => ({
      id: order.id,
      product_name: order.product_name,
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      created_at: order.created_at,
    }));
  const statusHref = (status?: OrderStatus) =>
    status
      ? `/admin/orders?status=${status}${missingCustomerFilter ? "&missingCustomer=1" : ""}`
      : `/admin/orders${missingCustomerFilter ? "?missingCustomer=1" : ""}`;
  const missingCustomerHref = missingCustomerFilter ? "/admin/orders" : "/admin/orders?missingCustomer=1";

  const statusPillClass = (status?: OrderStatus) =>
    [
      "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
      statusFilter === status || (!statusFilter && !status)
        ? "bg-[#2F2624] text-[#F6F1EC]"
        : "border border-[#3B2F2F]/14 bg-white/75 text-[#2E2323] hover:bg-white",
    ].join(" ");

  return (
    <main className="min-h-screen bg-[#FDF8F4] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <section className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-5 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#3B2F2F]/50">
                Private Admin
              </p>
              <p className="mt-1 text-xs text-[#3B2F2F]/65">Signed in as {adminSession.actorLabel}</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#1F1918] sm:text-4xl">
                Orders Console
              </h1>
            </div>
            <Link
              href="/admin/order-intents"
              className="rounded-full border border-[#3B2F2F]/14 bg-[#EEE4DB] px-3.5 py-1.5 text-xs font-medium text-[#2E2323] hover:bg-[#E7DBD1]"
            >
              Open Intent Review
            </Link>
            <Link
              href="/admin/audit"
              className="rounded-full border border-[#3B2F2F]/14 bg-[#EFE7DF] px-3.5 py-1.5 text-xs font-medium text-[#2E2323] hover:bg-[#E9DFD6]"
            >
              Audit Logs
            </Link>
            <Link
              href="/admin/notifications?status=failed&range=30d"
              className="rounded-full border border-[#3B2F2F]/14 bg-[#F1E7DE] px-3.5 py-1.5 text-xs font-medium text-[#2E2323] hover:bg-[#E9DDD2]"
            >
              Notifications
            </Link>
            <AdminLogoutButton />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={statusHref()} className={statusPillClass()}>
              All statuses
            </Link>
            <Link
              href={missingCustomerHref}
              className={[
                "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
                missingCustomerFilter
                  ? "bg-[#6A3E31] text-[#F6F1EC]"
                  : "border border-[#3B2F2F]/14 bg-white/75 text-[#2E2323] hover:bg-white",
              ].join(" ")}
            >
              Missing customer details
            </Link>
            {orderStatuses.map((status) => (
              <Link key={status} href={statusHref(status)} className={statusPillClass(status)}>
                {orderStatusLabel(status)}
              </Link>
            ))}
          </div>
        </header>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <article className="rounded-2xl border border-[#3B2F2F]/10 bg-white/85 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-[#3B2F2F]/55">Total orders</p>
            <p className="mt-2 text-2xl font-semibold text-[#1F1918]">{totalOrders.toLocaleString("en-PK")}</p>
          </article>
          <article className="rounded-2xl border border-[#3B2F2F]/10 bg-white/85 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-[#3B2F2F]/55">Open pipeline</p>
            <p className="mt-2 text-2xl font-semibold text-[#1F1918]">{totalOpen.toLocaleString("en-PK")}</p>
          </article>
          <article className="rounded-2xl border border-[#3B2F2F]/10 bg-white/85 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-[#3B2F2F]/55">Delivered</p>
            <p className="mt-2 text-2xl font-semibold text-[#1F1918]">
              {statusCounts.delivered.toLocaleString("en-PK")}
            </p>
          </article>
          <article className="rounded-2xl border border-[#3B2F2F]/10 bg-white/85 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-[#3B2F2F]/55">Latest update</p>
            <p className="mt-2 text-base font-semibold text-[#1F1918]">{formatDateTime(latestUpdate)}</p>
          </article>
          <article className="rounded-2xl border border-[#3B2F2F]/10 bg-white/85 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-[#3B2F2F]/55">Failed sends</p>
            <p className="mt-2 text-2xl font-semibold text-[#8A2F40]">
              {(failedCommunicationCount ?? 0).toLocaleString("en-PK")}
            </p>
            <Link href="/admin/audit?action=order_communication_failed" className="mt-1 inline-block text-xs text-[#3B2F2F]/72 underline underline-offset-2">
              Review failures
            </Link>
          </article>
        </div>

        <OrderDetailsQueue orders={incompleteQueue} />

        <OrdersTable orders={orders} />
      </section>
    </main>
  );
}
