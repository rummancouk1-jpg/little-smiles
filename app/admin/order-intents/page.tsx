import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminLogoutButton } from "@/components/admin/admin-logout-button";
import { CreateOrderFromIntentButton } from "@/components/admin/create-order-from-intent-button";
import { getAdminSessionFromPage } from "@/lib/admin-auth";
import { adminConfigHelpText, isAdminAuthConfigured } from "@/lib/admin-runtime";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

type OrderIntentRow = {
  product_slug: string | null;
  product_name: string | null;
  category: string | null;
  source_page: string;
  event_timestamp: string;
  price_pkr: number | null;
};

type GroupedIntentRow = {
  product_slug: string;
  product_name: string;
  category: string;
  source_page: string;
  total_clicks: number;
  latest_click_time: string;
  latest_price_pkr: number | null;
};

type LastExportInfo = {
  actorLabel: string;
  exportedAt: string;
  mode: string;
  range: string;
  rowCount: number | null;
};

type RangeFilter = "7d" | "30d" | "all";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function asSingle(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function resolveRange(input: string | undefined): RangeFilter {
  if (input === "7d" || input === "30d" || input === "all") return input;
  return "7d";
}

function cutoffIso(range: RangeFilter): string | null {
  if (range === "all") return null;
  const days = range === "7d" ? 7 : 30;
  const dt = new Date();
  dt.setDate(dt.getDate() - days);
  return dt.toISOString();
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

function groupIntents(rows: OrderIntentRow[]): GroupedIntentRow[] {
  const map = new Map<string, GroupedIntentRow>();

  for (const row of rows) {
    const productSlug = row.product_slug ?? "unknown";
    const productName = row.product_name ?? "Unknown product";
    const category = row.category ?? "Unknown";
    const sourcePage = row.source_page || "unknown";
    const latest = row.event_timestamp;
    const key = `${productSlug}::${productName}::${category}::${sourcePage}`;
    const existing = map.get(key);

    if (!existing) {
      map.set(key, {
        product_slug: productSlug,
        product_name: productName,
        category,
        source_page: sourcePage,
        total_clicks: 1,
        latest_click_time: latest,
        latest_price_pkr: row.price_pkr ?? null,
      });
      continue;
    }

    existing.total_clicks += 1;
    if (new Date(latest).getTime() > new Date(existing.latest_click_time).getTime()) {
      existing.latest_click_time = latest;
      existing.latest_price_pkr = row.price_pkr ?? existing.latest_price_pkr;
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (b.total_clicks !== a.total_clicks) return b.total_clicks - a.total_clicks;
    return new Date(b.latest_click_time).getTime() - new Date(a.latest_click_time).getTime();
  });
}

function readExportInfo(input: unknown): LastExportInfo | null {
  if (!input || typeof input !== "object") return null;
  const row = input as {
    actor_label?: unknown;
    created_at?: unknown;
    metadata?: unknown;
  };
  if (typeof row.actor_label !== "string" || typeof row.created_at !== "string") return null;

  const metadata =
    row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : null;
  const mode = typeof metadata?.mode === "string" ? metadata.mode : "unknown";
  const range = typeof metadata?.range === "string" ? metadata.range : "unknown";
  const rowCount =
    typeof metadata?.rowCount === "number" && Number.isFinite(metadata.rowCount) ? metadata.rowCount : null;

  return {
    actorLabel: row.actor_label,
    exportedAt: row.created_at,
    mode,
    range,
    rowCount,
  };
}

export const dynamic = "force-dynamic";

export default async function OrderIntentsAdminPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const range = resolveRange(asSingle(params.range));

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
    redirect(`/admin/login?next=${encodeURIComponent(`/admin/order-intents?range=${range}`)}`);
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
    .from("order_intents")
    .select("product_slug, product_name, category, source_page, event_timestamp, price_pkr")
    .order("event_timestamp", { ascending: false })
    .limit(5000);

  const cutoff = cutoffIso(range);
  if (cutoff) {
    query.gte("event_timestamp", cutoff);
  }

  const { data, error } = await query;
  if (error) {
    return (
      <main className="min-h-screen bg-[#FDF8F4] px-5 py-10 sm:px-6 lg:px-8">
        <section className="mx-auto max-w-3xl rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-7 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-9">
          <h1 className="text-3xl font-semibold tracking-tight text-[#1F1918]">Could not load data</h1>
          <p className="mt-3 text-sm leading-relaxed text-[#3B2F2F]/72">
            Supabase returned an error while reading order intents.
          </p>
        </section>
      </main>
    );
  }

  const rows = (data ?? []) as OrderIntentRow[];
  const grouped = groupIntents(rows);
  const totalIntents = rows.length;
  const { data: lastExportData } = await supabase
    .from("admin_audit_logs")
    .select("actor_label, created_at, metadata")
    .eq("action", "order_intents_exported")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const lastExport = readExportInfo(lastExportData);

  const productCounts = new Map<string, number>();
  const categoryCounts = new Map<string, number>();
  let latestIntentTime: string | null = null;

  for (const row of rows) {
    const productName = row.product_name ?? row.product_slug ?? "Unknown product";
    const category = row.category ?? "Unknown";
    productCounts.set(productName, (productCounts.get(productName) ?? 0) + 1);
    categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
    if (!latestIntentTime || new Date(row.event_timestamp).getTime() > new Date(latestIntentTime).getTime()) {
      latestIntentTime = row.event_timestamp;
    }
  }

  const topProduct =
    Array.from(productCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
  const topCategory =
    Array.from(categoryCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

  const filterHref = (r: RangeFilter) => `/admin/order-intents?range=${r}`;
  const exportHref = `/admin/order-intents/export?range=${range}&mode=grouped`;
  const exportRawHref = `/admin/order-intents/export?range=${range}&mode=raw`;
  const exportDailyHref = `/admin/order-intents/export?range=${range}&mode=daily`;
  const filterButtonClass = (r: RangeFilter) =>
    [
      "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
      range === r
        ? "bg-[#2F2624] text-[#F6F1EC]"
        : "border border-[#3B2F2F]/14 bg-white/75 text-[#2E2323] transition-colors hover:border-[#3B2F2F]/24 hover:bg-[#F2EAE4]",
    ].join(" ");

  return (
    <main className="min-h-screen bg-[#FDF8F4] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <section className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-5 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-7">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#3B2F2F]/50">
            Private Admin
          </p>
          <p className="mt-1 text-xs text-[#3B2F2F]/65">Signed in as {adminSession.actorLabel}</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#1F1918] sm:text-4xl">
            Order Intent Review
          </h1>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={filterHref("7d")} className={filterButtonClass("7d")}>
              Last 7 days
            </Link>
            <Link href={filterHref("30d")} className={filterButtonClass("30d")}>
              Last 30 days
            </Link>
            <Link href={filterHref("all")} className={filterButtonClass("all")}>
              All time
            </Link>
            <Link
              href={exportHref}
              className="rounded-full border border-[#3B2F2F]/14 bg-[#EDE3DA] px-3.5 py-1.5 text-xs font-medium text-[#2E2323] hover:bg-[#E7DBD1]"
            >
              Export Grouped CSV
            </Link>
            <Link
              href={exportRawHref}
              className="rounded-full border border-[#3B2F2F]/14 bg-[#EFE7DF] px-3.5 py-1.5 text-xs font-medium text-[#2E2323] hover:bg-[#E9DFD6]"
            >
              Export Raw CSV
            </Link>
            <Link
              href={exportDailyHref}
              className="rounded-full border border-[#3B2F2F]/14 bg-[#EFE4D8] px-3.5 py-1.5 text-xs font-medium text-[#2E2323] hover:bg-[#E9DDCF]"
            >
              Export Daily Summary CSV
            </Link>
            <Link
              href="/admin/orders"
              className="rounded-full border border-[#3B2F2F]/14 bg-[#E8DED4] px-3.5 py-1.5 text-xs font-medium text-[#2E2323] hover:bg-[#E2D6CB]"
            >
              Open Orders Console
            </Link>
            <Link
              href="/admin/audit"
              className="rounded-full border border-[#3B2F2F]/14 bg-[#ECE1D6] px-3.5 py-1.5 text-xs font-medium text-[#2E2323] hover:bg-[#E4D8CB]"
            >
              Audit Logs
            </Link>
            <AdminLogoutButton />
          </div>
        </header>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <article className="rounded-2xl border border-[#3B2F2F]/10 bg-white/85 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-[#3B2F2F]/55">Total intents</p>
            <p className="mt-2 text-2xl font-semibold text-[#1F1918]">{totalIntents.toLocaleString("en-PK")}</p>
          </article>
          <article className="rounded-2xl border border-[#3B2F2F]/10 bg-white/85 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-[#3B2F2F]/55">Top product</p>
            <p className="mt-2 text-base font-semibold text-[#1F1918]">{topProduct}</p>
          </article>
          <article className="rounded-2xl border border-[#3B2F2F]/10 bg-white/85 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-[#3B2F2F]/55">Top category</p>
            <p className="mt-2 text-base font-semibold text-[#1F1918]">{topCategory}</p>
          </article>
          <article className="rounded-2xl border border-[#3B2F2F]/10 bg-white/85 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-[#3B2F2F]/55">Latest intent</p>
            <p className="mt-2 text-base font-semibold text-[#1F1918]">{formatDateTime(latestIntentTime)}</p>
          </article>
          <Link
            href="/admin/audit?action=order_intents_exported"
            className="rounded-2xl border border-[#3B2F2F]/10 bg-white/85 p-4 transition-colors hover:border-[#3B2F2F]/18 hover:bg-[#FAF6F2]"
          >
            <p className="text-xs uppercase tracking-[0.14em] text-[#3B2F2F]/55">Last export</p>
            <p className="mt-2 text-sm font-semibold text-[#1F1918]">
              {lastExport ? formatDateTime(lastExport.exportedAt) : "No exports yet"}
            </p>
            <p className="mt-1 text-xs text-[#3B2F2F]/70">
              {lastExport
                ? `by ${lastExport.actorLabel} • ${lastExport.mode}/${lastExport.range}${
                    lastExport.rowCount !== null ? ` • ${lastExport.rowCount} rows` : ""
                  }`
                : "Export a CSV to create the first log entry."}
            </p>
            <p className="mt-2 text-xs font-medium text-[#3B2F2F]/70">View export audit logs</p>
          </Link>
        </div>

        <section className="overflow-hidden rounded-3xl border border-[#3B2F2F]/10 bg-white/90">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#F7F0EA]/85 text-xs uppercase tracking-[0.08em] text-[#3B2F2F]/58">
                <tr>
                  <th className="px-4 py-3">product_slug</th>
                  <th className="px-4 py-3">product_name</th>
                  <th className="px-4 py-3">category</th>
                  <th className="px-4 py-3">source_page</th>
                  <th className="px-4 py-3 text-right">total clicks</th>
                  <th className="px-4 py-3">latest click</th>
                  <th className="px-4 py-3">action</th>
                </tr>
              </thead>
              <tbody>
                {grouped.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-[#3B2F2F]/68" colSpan={7}>
                      No order intents found for this filter.
                    </td>
                  </tr>
                ) : (
                  grouped.map((row) => (
                    <tr key={`${row.product_slug}-${row.source_page}`} className="border-t border-[#3B2F2F]/8">
                      <td className="px-4 py-3 font-medium text-[#2E2323]">{row.product_slug}</td>
                      <td className="px-4 py-3 text-[#3B2F2F]/82">{row.product_name}</td>
                      <td className="px-4 py-3 text-[#3B2F2F]/82">{row.category}</td>
                      <td className="px-4 py-3 text-[#3B2F2F]/72">{row.source_page}</td>
                      <td className="px-4 py-3 text-right font-semibold text-[#2E2323]">
                        {row.total_clicks.toLocaleString("en-PK")}
                      </td>
                      <td className="px-4 py-3 text-[#3B2F2F]/72">
                        {formatDateTime(row.latest_click_time)}
                      </td>
                      <td className="px-4 py-3">
                        <CreateOrderFromIntentButton
                          productSlug={row.product_slug}
                          productName={row.product_name}
                          category={row.category}
                          pricePkr={row.latest_price_pkr ?? 0}
                          sourcePage={row.source_page}
                          latestIntentTimestamp={row.latest_click_time}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}
