// Editorial drafts queue. Moved to its own route in Commit T so the
// contentops root (/admin/contentops) could become the editorial
// overview. Behaviour preserved: same filter pills, same default
// landing on pending_review, same EditorialWelcome strip on first
// visit. The only changes are the baseHref (now /admin/contentops/drafts)
// and the addition of an "← Overview" link in the header.

import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminLogoutButton } from "@/components/admin/admin-logout-button";
import { DraftQueue } from "@/components/contentops/draft-queue";
import { EditorialWelcome } from "@/components/contentops/editorial-welcome";
import { getAdminSessionFromPage } from "@/lib/admin-auth";
import { adminConfigHelpText, isAdminAuthConfigured } from "@/lib/admin-runtime";
import { isDraftStatus, listDrafts, type DraftStatus } from "@/lib/contentops/drafts-store";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function asSingle(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export const dynamic = "force-dynamic";

export default async function EditorialQueuePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const rawStatus = asSingle(params.status);
  const showAll = rawStatus === "all";
  const status: DraftStatus | undefined = showAll
    ? undefined
    : rawStatus && isDraftStatus(rawStatus)
      ? rawStatus
      : "pending_review";

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
    const nextQuery = showAll
      ? "?status=all"
      : rawStatus && isDraftStatus(rawStatus)
        ? `?status=${rawStatus}`
        : "";
    const next = `/admin/contentops/drafts${nextQuery}`;
    redirect(`/admin/login?next=${encodeURIComponent(next)}`);
  }

  let drafts: Awaited<ReturnType<typeof listDrafts>> = [];
  let listError: string | null = null;
  try {
    drafts = await listDrafts(status);
  } catch (err) {
    listError = err instanceof Error ? err.message : "Failed to load drafts.";
  }

  const activeFilter: DraftStatus | "all" = showAll ? "all" : (status as DraftStatus);

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
                Editorial queue
              </h1>
              <p className="mt-2 text-sm text-[#3B2F2F]/65">
                Articles awaiting your review. Approved ones move to the publishing queue
                automatically.
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
                href="/admin/contentops"
                className="text-xs text-[#3B2F2F]/55 underline underline-offset-2 hover:text-[#3B2F2F]"
              >
                ← Overview
              </Link>
              <AdminLogoutButton />
            </div>
          </div>
        </header>

        {listError ? (
          <article className="rounded-3xl border border-[#8A2F40]/20 bg-[#FBEEF1] p-5 text-sm text-[#5E1C29] sm:p-6">
            <p className="font-medium">Unable to load drafts</p>
            <p className="mt-1 text-xs">{listError}</p>
          </article>
        ) : null}

        <EditorialWelcome />

        <DraftQueue
          drafts={drafts}
          activeStatus={activeFilter}
          baseHref="/admin/contentops/drafts"
          detailHref={(id) => `/admin/contentops/${id}`}
        />
      </section>
    </main>
  );
}
