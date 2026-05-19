// Operator landing surface. Lists articles cleared for publish (approved)
// and, historically, those already live. Reviewer never lands here.

import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminLogoutButton } from "@/components/admin/admin-logout-button";
import {
  PublishingQueue,
  type OperatorFilter,
} from "@/components/contentops/publishing-queue";
import { getAdminSessionFromPage } from "@/lib/admin-auth";
import { adminConfigHelpText, isAdminAuthConfigured } from "@/lib/admin-runtime";
import { listDrafts, type Draft } from "@/lib/contentops/drafts-store";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function asSingle(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function isOperatorFilter(v: string): v is OperatorFilter {
  return (
    v === "approved" ||
    v === "scheduled" ||
    v === "published" ||
    v === "all"
  );
}

function readySinceMs(draft: Draft): number {
  const raw =
    draft.status === "scheduled"
      ? (draft.scheduled_at ?? draft.created_at)
      : draft.status === "published"
        ? (draft.published_at ?? draft.created_at)
        : draft.status === "approved"
          ? (draft.approved_at ?? draft.created_at)
          : draft.created_at;
  const t = new Date(raw).getTime();
  return Number.isNaN(t) ? 0 : t;
}

export const dynamic = "force-dynamic";

export default async function PublishingQueuePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const raw = asSingle(params.filter);
  const activeFilter: OperatorFilter =
    raw && isOperatorFilter(raw) ? raw : "approved";

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
    const nextQuery = activeFilter === "approved" ? "" : `?filter=${activeFilter}`;
    const next = `/admin/contentops/publishing${nextQuery}`;
    redirect(`/admin/login?next=${encodeURIComponent(next)}`);
  }

  let drafts: Draft[] = [];
  let listError: string | null = null;
  try {
    if (activeFilter === "all") {
      const [approved, scheduled, published] = await Promise.all([
        listDrafts("approved"),
        listDrafts("scheduled"),
        listDrafts("published"),
      ]);
      drafts = [...approved, ...scheduled, ...published].sort(
        (a, b) => readySinceMs(b) - readySinceMs(a),
      );
    } else {
      drafts = await listDrafts(activeFilter);
    }
  } catch (err) {
    listError = err instanceof Error ? err.message : "Failed to load publishing queue.";
  }

  return (
    <main className="min-h-screen bg-[#FDF8F4] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <section className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-5 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#3B2F2F]/50">
                Operator view
              </p>
              <p className="mt-1 text-xs text-[#3B2F2F]/65">
                Signed in as {adminSession.actorLabel}
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#1F1918] sm:text-4xl">
                Publishing queue
              </h1>
              <p className="mt-2 text-sm text-[#3B2F2F]/65">
                Articles cleared for publish.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/admin/contentops"
                className="text-xs text-[#3B2F2F]/55 underline underline-offset-2 hover:text-[#3B2F2F]"
              >
                ← Editorial queue
              </Link>
              <AdminLogoutButton />
            </div>
          </div>
        </header>

        {listError ? (
          <article className="rounded-3xl border border-[#8A2F40]/20 bg-[#FBEEF1] p-5 text-sm text-[#5E1C29] sm:p-6">
            <p className="font-medium">Unable to load publishing queue</p>
            <p className="mt-1 text-xs">{listError}</p>
          </article>
        ) : null}

        <PublishingQueue
          drafts={drafts}
          activeFilter={activeFilter}
          baseHref="/admin/contentops/publishing"
          detailHref={(id) => `/admin/contentops/publishing/${id}`}
        />
      </section>
    </main>
  );
}
