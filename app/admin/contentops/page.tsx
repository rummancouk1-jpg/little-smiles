import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminSectionNav } from "@/components/admin/admin-section-nav";
import { DraftQueue } from "@/components/contentops/draft-queue";
import { NewDraftForm } from "@/components/contentops/new-draft-form";
import { getAdminSessionFromPage } from "@/lib/admin-auth";
import { adminConfigHelpText, isAdminAuthConfigured } from "@/lib/admin-runtime";
import {
  countDraftsByStatus,
  listDrafts,
  listOperatorQueueDrafts,
  type DraftStatus,
  type DraftStatusCounts,
} from "@/lib/contentops/drafts-store";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function asSingle(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

// Only in-queue statuses are selectable here — the operator's queue is work
// that still needs a human. rejected (machine-final) and published (done, on
// its own /published page) never surface in this view.
const OPERATOR_STATUSES: DraftStatus[] = ["pending_review", "approved"];
function isOperatorStatus(v: string): v is DraftStatus {
  return (OPERATOR_STATUSES as string[]).includes(v);
}

export const dynamic = "force-dynamic";

export default async function ContentOpsQueuePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const rawStatus = asSingle(params.status);
  // A pending/approved filter narrows the queue; anything else (undefined, or a
  // rejected/published link) falls back to the full operator queue.
  const status: DraftStatus | undefined =
    rawStatus && isOperatorStatus(rawStatus) ? rawStatus : undefined;

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
    // Counts come from the full draft table; the visible slice is the operator
    // queue (pending + approved), or a single pending/approved filter when set.
    // Running both in parallel keeps the request fast.
    [drafts, counts] = await Promise.all([
      status ? listDrafts(status) : listOperatorQueueDrafts(),
      countDraftsByStatus(),
    ]);
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
                ContentOps queue
              </h1>
              <p className="mt-1 text-xs text-ink-base/65">
                Drafts awaiting your action — pending review + approved-awaiting-publish. Rejected
                drafts leave the queue; published posts live on the Published page.
              </p>
            </div>
            <AdminSectionNav
              active="contentops"
              extraActions={
                <Link
                  href="/admin/contentops/published"
                  className="rounded-full border border-ink-base/14 bg-surface-raised px-3.5 py-1.5 text-xs font-medium text-ink-walnut hover:bg-surface-hover"
                >
                  Published →
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

        <NewDraftForm
          generateHref="/api/admin/contentops/drafts/generate"
          detailBaseHref="/admin/contentops"
          suggestionsHref="/api/admin/contentops/topic-suggestions"
        />

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
