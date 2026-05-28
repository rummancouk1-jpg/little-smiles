import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminSectionNav } from "@/components/admin/admin-section-nav";
import { getAdminSessionFromPage } from "@/lib/admin-auth";
import { adminConfigHelpText, isAdminAuthConfigured } from "@/lib/admin-runtime";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

type RangeFilter = "7d" | "30d" | "all";

type AuditLogRow = {
  id: string;
  actor_label: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

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

function shorten(value: string | null, limit: number): string {
  if (!value) return "—";
  if (value.length <= limit) return value;
  return `${value.slice(0, limit)}...`;
}

export const dynamic = "force-dynamic";

export default async function AdminAuditPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const range = resolveRange(asSingle(params.range));
  const actionFilter = asSingle(params.action);
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
    const next = `/admin/audit?range=${range}${actionFilter ? `&action=${encodeURIComponent(actionFilter)}` : ""}`;
    redirect(`/admin/login?next=${encodeURIComponent(next)}`);
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return (
      <main className="min-h-screen bg-[#FDF8F4] px-5 py-10 sm:px-6 lg:px-8">
        <section className="mx-auto max-w-3xl rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-7 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-9">
          <h1 className="text-3xl font-semibold tracking-tight text-[#1F1918]">Supabase Not Configured</h1>
          <p className="mt-3 text-sm leading-relaxed text-[#3B2F2F]/72">
            Configure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` on the server.
          </p>
        </section>
      </main>
    );
  }

  const query = supabase
    .from("admin_audit_logs")
    .select("id, actor_label, action, target_type, target_id, ip_address, user_agent, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(500);

  const cutoff = cutoffIso(range);
  if (cutoff) query.gte("created_at", cutoff);
  if (actionFilter && actionFilter !== "all") query.eq("action", actionFilter);

  const { data, error } = await query;
  if (error) {
    return (
      <main className="min-h-screen bg-[#FDF8F4] px-5 py-10 sm:px-6 lg:px-8">
        <section className="mx-auto max-w-3xl rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-7 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-9">
          <h1 className="text-3xl font-semibold tracking-tight text-[#1F1918]">Audit table unavailable</h1>
          <p className="mt-3 text-sm leading-relaxed text-[#3B2F2F]/72">
            Apply `supabase/admin-audit-schema.sql` in Supabase, then refresh this page.
          </p>
        </section>
      </main>
    );
  }

  const rows = (data ?? []) as AuditLogRow[];
  const actionOptions = Array.from(new Set(rows.map((row) => row.action))).sort((a, b) =>
    a.localeCompare(b),
  );

  const filterHref = (nextRange: RangeFilter) =>
    `/admin/audit?range=${nextRange}${actionFilter ? `&action=${encodeURIComponent(actionFilter)}` : ""}`;
  const actionHref = (action: string) =>
    `/admin/audit?range=${range}${action === "all" ? "" : `&action=${encodeURIComponent(action)}`}`;

  const buttonClass = (isActive: boolean) =>
    [
      "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
      isActive
        ? "bg-[#2F2624] text-[#F6F1EC]"
        : "border border-[#3B2F2F]/14 bg-white/75 text-[#2E2323] transition-colors hover:border-[#3B2F2F]/24 hover:bg-[#F2EAE4]",
    ].join(" ");

  return (
    <main className="min-h-screen bg-[#FDF8F4] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <section className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-5 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#3B2F2F]/50">Private Admin</p>
              <p className="mt-1 text-xs text-[#3B2F2F]/65">Signed in as {adminSession.actorLabel}</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#1F1918] sm:text-4xl">Audit Logs</h1>
              <p className="mt-1 text-xs text-[#3B2F2F]/65">
                A timestamped trail of every admin action — useful for spotting unexpected activity
                or tracing what changed. Read-only.
              </p>
            </div>
            <AdminSectionNav
              active="audit"
              extraActions={
                <>
                  <Link
                    href="/admin/orders"
                    className="rounded-full border border-[#3B2F2F]/14 bg-[#EEE4DB] px-3.5 py-1.5 text-xs font-medium text-[#2E2323] hover:bg-[#E7DBD1]"
                  >
                    Orders Console
                  </Link>
                  <Link
                    href="/admin/order-intents"
                    className="rounded-full border border-[#3B2F2F]/14 bg-[#EFE7DF] px-3.5 py-1.5 text-xs font-medium text-[#2E2323] hover:bg-[#E9DFD6]"
                  >
                    Intent Review
                  </Link>
                </>
              }
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={filterHref("7d")} className={buttonClass(range === "7d")}>
              Last 7 days
            </Link>
            <Link href={filterHref("30d")} className={buttonClass(range === "30d")}>
              Last 30 days
            </Link>
            <Link href={filterHref("all")} className={buttonClass(range === "all")}>
              All time
            </Link>
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            <Link href={actionHref("all")} className={buttonClass(!actionFilter || actionFilter === "all")}>
              All actions
            </Link>
            {actionOptions.slice(0, 12).map((action) => (
              <Link key={action} href={actionHref(action)} className={buttonClass(actionFilter === action)}>
                {action}
              </Link>
            ))}
          </div>
        </header>

        <section className="overflow-hidden rounded-3xl border border-[#3B2F2F]/10 bg-white/90">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#F7F0EA]/85 text-xs uppercase tracking-[0.08em] text-[#3B2F2F]/58">
                <tr>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Target</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">IP</th>
                  <th className="px-4 py-3">User Agent</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-[#3B2F2F]/68" colSpan={6}>
                      No audit records for this filter.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="border-t border-[#3B2F2F]/8">
                      <td className="whitespace-nowrap px-4 py-3 text-[#3B2F2F]/82">
                        {formatDateTime(row.created_at)}
                      </td>
                      <td className="px-4 py-3 font-medium text-[#2E2323]">{row.action}</td>
                      <td className="px-4 py-3 text-[#3B2F2F]/78">
                        {row.target_type ?? "—"}
                        {row.target_id ? `:${row.target_id.slice(0, 8)}` : ""}
                      </td>
                      <td className="px-4 py-3 text-[#3B2F2F]/78">{row.actor_label}</td>
                      <td className="px-4 py-3 text-[#3B2F2F]/72">{row.ip_address ?? "—"}</td>
                      <td className="px-4 py-3 text-[#3B2F2F]/72">{shorten(row.user_agent, 70)}</td>
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
