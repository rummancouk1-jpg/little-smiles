import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminLogoutButton } from "@/components/admin/admin-logout-button";
import { getAdminSessionFromPage } from "@/lib/admin-auth";
import { adminConfigHelpText, isAdminAuthConfigured } from "@/lib/admin-runtime";
import {
  buildReadinessReport,
  summariseLevels,
  type ProviderReport,
  type ReadinessItem,
  type ReadinessLevel,
} from "@/lib/operational-readiness";

export const dynamic = "force-dynamic";

function levelBadgeClass(level: ReadinessLevel): string {
  if (level === "ready") return "bg-[#E7F4EA] text-[#2E6A41]";
  if (level === "warning") return "bg-[#FBEEDE] text-[#7A4A12]";
  return "bg-[#F8E8EA] text-[#8A2F40]";
}

function levelLabel(level: ReadinessLevel): string {
  if (level === "ready") return "ready";
  if (level === "warning") return "warning";
  return "missing";
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

function ItemRow({ item }: { item: ReadinessItem }) {
  return (
    <li className="flex items-start gap-3 border-b border-[#3B2F2F]/8 py-2 last:border-b-0">
      <span
        className={[
          "mt-0.5 inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
          levelBadgeClass(item.level),
        ].join(" ")}
      >
        {levelLabel(item.level)}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-[#1F1918]">{item.label}</p>
        <p className="mt-0.5 text-xs text-[#3B2F2F]/72">{item.detail}</p>
      </div>
    </li>
  );
}

function ProviderCard({ provider }: { provider: ProviderReport }) {
  const summary = summariseLevels(provider.items);
  return (
    <article className="rounded-3xl border border-[#3B2F2F]/10 bg-white/90 p-5 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-[#1F1918]">{provider.label}</h3>
        <span
          className={[
            "inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide",
            levelBadgeClass(summary),
          ].join(" ")}
        >
          {levelLabel(summary)}
        </span>
      </header>
      <ul className="mt-3">
        {provider.items.map((item, idx) => (
          <ItemRow key={`${provider.key}-${idx}`} item={item} />
        ))}
      </ul>
    </article>
  );
}

export default async function ReadinessAdminPage() {
  if (!isAdminAuthConfigured()) {
    return (
      <main className="min-h-screen bg-[#FDF8F4] px-5 py-10 sm:px-6 lg:px-8">
        <section className="mx-auto max-w-3xl rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-7 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-9">
          <h1 className="text-3xl font-semibold tracking-tight text-[#1F1918]">Admin Locked</h1>
          <p className="mt-3 text-sm leading-relaxed text-[#3B2F2F]/72">{adminConfigHelpText()}</p>
        </section>
      </main>
    );
  }

  const session = await getAdminSessionFromPage();
  if (!session) {
    redirect("/admin/login?next=%2Fadmin%2Freadiness");
  }

  const report = await buildReadinessReport();

  return (
    <main className="min-h-screen bg-[#FDF8F4] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <section className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-5 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#3B2F2F]/50">Private Admin</p>
              <p className="mt-1 text-xs text-[#3B2F2F]/65">Signed in as {session.actorLabel}</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#1F1918] sm:text-4xl">
                Production Readiness
              </h1>
              <p className="mt-1 text-xs text-[#3B2F2F]/65">
                Generated {formatDateTime(report.generatedAt)} — config-level checks only, no external calls.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/admin/seo"
                className="rounded-full border border-[#3B2F2F]/14 bg-[#EEE4DB] px-3.5 py-1.5 text-xs font-medium text-[#2E2323] hover:bg-[#E7DBD1]"
              >
                SEO Intelligence
              </Link>
              <Link
                href="/admin/notifications"
                className="rounded-full border border-[#3B2F2F]/14 bg-[#EEE4DB] px-3.5 py-1.5 text-xs font-medium text-[#2E2323] hover:bg-[#E7DBD1]"
              >
                Notifications
              </Link>
              <Link
                href="/admin/contentops"
                className="rounded-full border border-[#3B2F2F]/14 bg-[#EEE4DB] px-3.5 py-1.5 text-xs font-medium text-[#2E2323] hover:bg-[#E7DBD1]"
              >
                ContentOps
              </Link>
              <AdminLogoutButton />
            </div>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {report.providers.map((provider) => (
            <ProviderCard key={provider.key} provider={provider} />
          ))}
          <ProviderCard provider={report.seo} />
        </section>

        <section className="rounded-3xl border border-[#3B2F2F]/10 bg-white/90 p-5 sm:p-6">
          <h2 className="text-base font-semibold text-[#1F1918]">Cron health</h2>
          <p className="mt-1 text-xs text-[#3B2F2F]/65">
            Each scheduled job writes an audit row when it runs. Stale or missing rows surface here.
          </p>
          <ul className="mt-4 space-y-3">
            {report.crons.map((cron) => (
              <li key={cron.action} className="rounded-2xl border border-[#3B2F2F]/10 bg-[#FDF8F4] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[#1F1918]">{cron.label}</p>
                  <span
                    className={[
                      "inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide",
                      levelBadgeClass(cron.level),
                    ].join(" ")}
                  >
                    {levelLabel(cron.level)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#3B2F2F]/65">Schedule: {cron.expectedScheduleUtc}</p>
                <p className="mt-1 text-xs text-[#3B2F2F]/65">{cron.detail}</p>
                <p className="mt-2 text-xs text-[#3B2F2F]/72">
                  Last run: <strong>{formatDateTime(cron.lastRunAt)}</strong>
                </p>
                {cron.lastRunSummary ? (
                  <pre className="mt-2 overflow-x-auto rounded-xl bg-[#2F2624] p-3 text-[11px] leading-relaxed text-[#F6F1EC]">
                    {JSON.stringify(cron.lastRunSummary, null, 2)}
                  </pre>
                ) : null}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-3xl border border-[#3B2F2F]/10 bg-white/90 p-5 sm:p-6">
          <h2 className="text-base font-semibold text-[#1F1918]">SEO snapshot freshness</h2>
          <p className="mt-1 text-xs text-[#3B2F2F]/65">
            Latest row from each snapshot table. Independent of the cron audit — answers "do we have usable data?"
            instead of "did the cron try?".
          </p>
          <ul className="mt-4 space-y-3">
            {report.snapshotFreshness.map((snap) => (
              <li key={snap.label} className="rounded-2xl border border-[#3B2F2F]/10 bg-[#FDF8F4] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[#1F1918]">{snap.label}</p>
                  <span
                    className={[
                      "inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide",
                      levelBadgeClass(snap.level),
                    ].join(" ")}
                  >
                    {levelLabel(snap.level)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#3B2F2F]/65">
                  Latest snapshot: <strong>{snap.snapshotDate ?? "—"}</strong>
                  {snap.rowCount !== null ? ` · ${snap.rowCount} rows` : null}
                </p>
                <p className="mt-1 text-xs text-[#3B2F2F]/72">{snap.detail}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-3xl border border-[#3B2F2F]/10 bg-white/90 p-5 sm:p-6">
          <h2 className="text-base font-semibold text-[#1F1918]">ContentOps queue</h2>
          {report.contentopsError ? (
            <p className="mt-2 text-sm text-[#8A2F40]">{report.contentopsError}</p>
          ) : report.contentops ? (
            <>
              <p className="mt-1 text-xs text-[#3B2F2F]/65">{report.contentops.detail}</p>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {Object.entries(report.contentops.counts).map(([status, count]) => (
                  <div key={status} className="rounded-2xl border border-[#3B2F2F]/10 bg-[#FDF8F4] p-3">
                    <dt className="text-[11px] uppercase tracking-wide text-[#3B2F2F]/55">{status.replace("_", " ")}</dt>
                    <dd className="mt-0.5 text-xl font-semibold text-[#1F1918]">{count}</dd>
                  </div>
                ))}
              </dl>
              <ul className="mt-4 space-y-2 text-sm text-[#3B2F2F]/82">
                <li>
                  Approved ready to publish: <strong>{report.contentops.approvedReadyToPublish}</strong>
                </li>
                <li>
                  Approved with schema issues: <strong>{report.contentops.approvedWithSchemaIssues}</strong>
                </li>
                <li>
                  Approved missing hero image: <strong>{report.contentops.approvedMissingHeroImage}</strong>
                </li>
              </ul>
            </>
          ) : (
            <p className="mt-2 text-sm text-[#3B2F2F]/72">No data available.</p>
          )}
        </section>
      </section>
    </main>
  );
}
