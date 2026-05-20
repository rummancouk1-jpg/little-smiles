// Editorial overview — the calm publishing operations desk. The root of
// /admin/contentops landed on the editorial drafts queue before Commit T;
// the queue now lives at /admin/contentops/drafts and this surface
// serves as the home for the whole editorial loop.
//
// Layout, top to bottom:
//   1. Header (Overview · "+ Create draft" primary, AdminLogoutButton)
//   2. Insights strip — calm operational hints (renders nothing if balanced)
//   3. Overview cards — 5 compact cards across the loop
//   4. Publishing cadence — forward-looking 3-bucket timeline
//
// All data is fetched in parallel and each query catches its own
// failure so a single broken slice degrades gracefully (the
// corresponding card shows zero / empty copy rather than the whole
// page erroring).

import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminLogoutButton } from "@/components/admin/admin-logout-button";
import { InsightsStrip } from "@/components/contentops/insights-strip";
import { OverviewCards } from "@/components/contentops/overview-cards";
import { PublishingCadence } from "@/components/contentops/publishing-cadence";
import { getAdminSessionFromPage } from "@/lib/admin-auth";
import { adminConfigHelpText, isAdminAuthConfigured } from "@/lib/admin-runtime";
import { listDrafts, type Draft } from "@/lib/contentops/drafts-store";
import { listTopics, type Topic } from "@/lib/contentops/topics-store";

export const dynamic = "force-dynamic";

export default async function EditorialOverviewPage() {
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

  const adminSession = await getAdminSessionFromPage();
  if (!adminSession) {
    redirect(`/admin/login?next=${encodeURIComponent("/admin/contentops")}`);
  }

  const [
    pendingDrafts,
    approvedDrafts,
    scheduledDrafts,
    publishedDrafts,
    queuedTopics,
  ] = (await Promise.all([
    listDrafts("pending_review").catch(() => [] as Draft[]),
    listDrafts("approved").catch(() => [] as Draft[]),
    listDrafts("scheduled").catch(() => [] as Draft[]),
    listDrafts("published").catch(() => [] as Draft[]),
    listTopics("queued").catch(() => [] as Topic[]),
  ])) as [Draft[], Draft[], Draft[], Draft[], Topic[]];

  return (
    <main className="min-h-screen bg-[#FDF8F4] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <section className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-5 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#3B2F2F]/50">
                Editorial
              </p>
              <p className="mt-1 text-xs text-[#3B2F2F]/65">
                Signed in as {adminSession.actorLabel}
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#1F1918] sm:text-4xl">
                Overview
              </h1>
              <p className="mt-2 text-sm text-[#3B2F2F]/65">
                Your calm publishing operations desk. What&rsquo;s active, what&rsquo;s
                next, and where the editorial momentum stands.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/admin/contentops/new"
                className="rounded-full bg-[#2F2624] px-4 py-2 text-sm font-medium text-[#F6F1EC] transition-opacity hover:opacity-90"
              >
                + Create draft
              </Link>
              <Link
                href="/admin/contentops/analytics"
                className="text-xs text-[#3B2F2F]/55 underline underline-offset-2 hover:text-[#3B2F2F]"
              >
                Analytics →
              </Link>
              <Link
                href="/admin/contentops/settings/notifications"
                className="text-xs text-[#3B2F2F]/55 underline underline-offset-2 hover:text-[#3B2F2F]"
              >
                Notifications →
              </Link>
              <AdminLogoutButton />
            </div>
          </div>
        </header>

        <InsightsStrip
          pendingDrafts={pendingDrafts}
          approvedDrafts={approvedDrafts}
          scheduledDrafts={scheduledDrafts}
          queuedTopics={queuedTopics}
        />

        <OverviewCards
          pendingDrafts={pendingDrafts}
          approvedDrafts={approvedDrafts}
          scheduledDrafts={scheduledDrafts}
          publishedDrafts={publishedDrafts}
          queuedTopics={queuedTopics}
        />

        <PublishingCadence scheduledDrafts={scheduledDrafts} />
      </section>
    </main>
  );
}
