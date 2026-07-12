import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminSectionNav } from "@/components/admin/admin-section-nav";
import { DraftQueue } from "@/components/contentops/draft-queue";
import { getAdminSessionFromPage } from "@/lib/admin-auth";
import { adminConfigHelpText, isAdminAuthConfigured } from "@/lib/admin-runtime";
import {
  countDraftsByStatus,
  isDraftStatus,
  listDrafts,
  type DraftStatus,
  type DraftStatusCounts,
} from "@/lib/contentops/drafts-store";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function asSingle(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export const dynamic = "force-dynamic";

export default async function ContentOpsQueuePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const rawStatus = asSingle(params.status);
  const status: DraftStatus | undefined =
    rawStatus && isDraftStatus(rawStatus) ? rawStatus : undefined;

  if (!isAdminAuthConfigured()) {
    return (
      <main className="min-h-screen bg-surface-page px-5 py-10 sm:px-6 lg:px-8">
        <section className="mx-auto max-w-3xl rounded-3xl border border-ink-base/10 bg-surface-card/90 p-7 shadow-card-rest sm:p-9">
          <h1 className="font-heading text-3xl font-semibold text-ink-strong">Admin Locked</h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-base/72">{adminConfigHelpText()}</p>
        </section>
      </main>
    );
  }

  const adminSession = await getAdminSessionFromPage();
  if (!adminSession) {
    const next = status ? `/admin/contentops?status=${status}` : "/admin/contentops";
    redirect(`/admin/login?next=${encodeURIComponent(next)}`);
  }

  let drafts: Awaited<ReturnType<typeof listDrafts>> = [];
  let counts: DraftStatusCounts = { all: 0, pending_review: 0, approved: 0, rejected: 0, published: 0 };
  let listError: string | null = null;
  try {
    // Counts come from the full draft table; the visible slice respects the
    // status filter. Running both in parallel keeps the request fast.
    [drafts, counts] = await Promise.all([listDrafts(status), countDraftsByStatus()]);
  } catch (err) {
    listError = err instanceof Error ? err.message : "Failed to load drafts.";
  }

  return (
    <main className="min-h-screen bg-surface-page px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <section className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-ink-base/10 bg-surface-card/90 p-5 shadow-card-rest sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="eyebrow">Private Admin</p>
              <p className="mt-1 text-xs text-ink-base/65">Signed in as {adminSession.actorLabel}</p>
              <h1 className="mt-2 font-heading text-3xl font-semibold text-ink-strong sm:text-4xl">
                ContentOps drafts
              </h1>
              <p className="mt-1 text-xs text-ink-base/65">
                Review, edit, and approve blog drafts before they go live. Badges use the
                same rules as the SEO Intelligence page — green here means green there.
              </p>
            </div>
            <AdminSectionNav
              active="contentops"
              extraActions={
                <Link
                  href="/admin/seo"
                  className="rounded-full border border-ink-base/14 bg-surface-raised px-3.5 py-1.5 text-xs font-medium text-ink-walnut hover:bg-surface-hover"
                >
                  ← Back to SEO Intelligence
                </Link>
              }
            />
          </div>
        </header>

        {listError ? (
          <article className="rounded-3xl border border-tone-danger/25 bg-emphasis-berry-tint p-5 text-sm text-tone-danger sm:p-6">
            <p className="font-medium">Unable to load drafts</p>
            <p className="mt-1 text-xs">{listError}</p>
          </article>
        ) : null}

        <DraftQueue
          drafts={drafts}
          counts={counts}
          activeStatus={status ?? "all"}
          baseHref="/admin/contentops"
          detailHref={(id) => `/admin/contentops/${id}`}
        />
      </section>
    </main>
  );
}
