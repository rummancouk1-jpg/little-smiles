import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminLogoutButton } from "@/components/admin/admin-logout-button";
import { NotificationsTable } from "@/components/admin/notifications-table";
import { getAdminSessionFromPage } from "@/lib/admin-auth";
import { adminConfigHelpText, isAdminAuthConfigured } from "@/lib/admin-runtime";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

type StatusFilter = "all" | "failed" | "sent" | "queued";
type RangeFilter = "7d" | "30d" | "all";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type LastRetryRunSummary = {
  createdAt: string;
  attempted: number;
  sent: number;
  failed: number;
};

function asSingle(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function resolveStatus(input: string | undefined): StatusFilter {
  if (input === "failed" || input === "sent" || input === "queued" || input === "all") return input;
  return "failed";
}

function resolveRange(input: string | undefined): RangeFilter {
  if (input === "7d" || input === "30d" || input === "all") return input;
  return "30d";
}

function cutoffIso(range: RangeFilter): string | null {
  if (range === "all") return null;
  const days = range === "7d" ? 7 : 30;
  const dt = new Date();
  dt.setDate(dt.getDate() - days);
  return dt.toISOString();
}

function readLastRetryRun(input: unknown): LastRetryRunSummary | null {
  if (!input || typeof input !== "object") return null;
  const row = input as { created_at?: unknown; metadata?: unknown };
  if (typeof row.created_at !== "string") return null;
  const metadata =
    row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : null;
  const attempted = typeof metadata?.attempted === "number" ? metadata.attempted : 0;
  const sent = typeof metadata?.sent === "number" ? metadata.sent : 0;
  const failed = typeof metadata?.failed === "number" ? metadata.failed : 0;
  return { createdAt: row.created_at, attempted, sent, failed };
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

function cronHealthStatus(lastRunAt: string | null): { label: "healthy" | "stale" | "missing"; detail: string } {
  if (!lastRunAt) {
    return { label: "missing", detail: "No retry run found yet." };
  }
  const last = new Date(lastRunAt).getTime();
  if (!Number.isFinite(last)) {
    return { label: "stale", detail: "Latest run timestamp is invalid." };
  }
  const ageMinutes = Math.floor((Date.now() - last) / 60000);
  if (ageMinutes <= 25) {
    return { label: "healthy", detail: `Last run ${ageMinutes} minute${ageMinutes === 1 ? "" : "s"} ago.` };
  }
  return { label: "stale", detail: `Last run ${ageMinutes} minute${ageMinutes === 1 ? "" : "s"} ago.` };
}

export const dynamic = "force-dynamic";

export default async function NotificationsAdminPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const status = resolveStatus(asSingle(params.status));
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

  const session = await getAdminSessionFromPage();
  if (!session) {
    redirect("/admin/login?next=%2Fadmin%2Fnotifications");
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
    .from("order_communications")
    .select(
      "id, order_id, event_type, channel, recipient_phone, delivery_status, retry_count, max_retries, next_retry_at, last_error, created_at, sent_at",
    )
    .order("created_at", { ascending: false })
    .limit(500);

  if (status !== "all") query.eq("delivery_status", status);
  const cutoff = cutoffIso(range);
  if (cutoff) query.gte("created_at", cutoff);

  const { data } = await query;
  const rows = (data ?? []) as Array<{
    id: string;
    order_id: string;
    event_type: "order_confirmed" | "order_dispatched" | "order_delivered" | "order_cancelled";
    channel: "whatsapp" | "sms";
    recipient_phone: string | null;
    delivery_status: "queued" | "sent" | "failed";
    retry_count: number;
    max_retries: number;
    next_retry_at: string | null;
    last_error: string | null;
    created_at: string;
    sent_at: string | null;
  }>;
  const { data: lastRetryAudit } = await supabase
    .from("admin_audit_logs")
    .select("created_at, metadata")
    .eq("action", "order_communication_auto_retry_run")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const lastRetryRun = readLastRetryRun(lastRetryAudit);
  const health = cronHealthStatus(lastRetryRun?.createdAt ?? null);

  const hrefFor = (nextStatus: StatusFilter, nextRange: RangeFilter) =>
    `/admin/notifications?status=${nextStatus}&range=${nextRange}`;
  const pill = (active: boolean) =>
    [
      "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
      active
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
              <p className="mt-1 text-xs text-[#3B2F2F]/65">Signed in as {session.actorLabel}</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#1F1918] sm:text-4xl">
                Notifications Monitor
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/admin/orders"
                className="rounded-full border border-[#3B2F2F]/14 bg-[#EEE4DB] px-3.5 py-1.5 text-xs font-medium text-[#2E2323] hover:bg-[#E7DBD1]"
              >
                Orders Console
              </Link>
              <Link
                href="/admin/audit?action=order_communication_failed"
                className="rounded-full border border-[#3B2F2F]/14 bg-[#EFE7DF] px-3.5 py-1.5 text-xs font-medium text-[#2E2323] hover:bg-[#E9DFD6]"
              >
                Failure Audit
              </Link>
              <AdminLogoutButton />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {(["failed", "all", "sent", "queued"] as StatusFilter[]).map((item) => (
              <Link key={item} href={hrefFor(item, range)} className={pill(status === item)}>
                {item}
              </Link>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["7d", "30d", "all"] as RangeFilter[]).map((item) => (
              <Link key={item} href={hrefFor(status, item)} className={pill(range === item)}>
                {item === "all" ? "all time" : `last ${item.replace("d", " days")}`}
              </Link>
            ))}
          </div>
        </header>

        <section className="rounded-3xl border border-[#3B2F2F]/10 bg-white/90 p-5 sm:p-6">
          <p className="text-xs uppercase tracking-[0.14em] text-[#3B2F2F]/55">Last cron run</p>
          <p className="mt-1">
            <span
              className={[
                "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                health.label === "healthy"
                  ? "bg-[#E7F4EA] text-[#2E6A41]"
                  : health.label === "stale"
                    ? "bg-[#F8E8EA] text-[#8A2F40]"
                    : "bg-[#EFECE8] text-[#5A4B47]",
              ].join(" ")}
            >
              {health.label}
            </span>
          </p>
          <p className="mt-2 text-base font-semibold text-[#1F1918]">
            {lastRetryRun ? formatDateTime(lastRetryRun.createdAt) : "No retry run logged yet"}
          </p>
          <p className="mt-1 text-sm text-[#3B2F2F]/74">
            {lastRetryRun
              ? `Attempted ${lastRetryRun.attempted}, sent ${lastRetryRun.sent}, failed ${lastRetryRun.failed}`
              : "Cron or manual retry has not produced an audit summary yet."}
          </p>
          <p className="mt-1 text-xs text-[#3B2F2F]/68">{health.detail}</p>
        </section>

        <NotificationsTable rows={rows} />
      </section>
    </main>
  );
}
