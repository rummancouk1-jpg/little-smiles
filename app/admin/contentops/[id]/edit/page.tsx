import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AdminSectionNav } from "@/components/admin/admin-section-nav";
import { DraftEditor } from "@/components/contentops/draft-editor";
import { getAdminSessionFromPage } from "@/lib/admin-auth";
import { adminConfigHelpText, isAdminAuthConfigured } from "@/lib/admin-runtime";
import { getDraftById } from "@/lib/contentops/drafts-store";

type PageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export default async function ContentOpsDraftEditPage({ params }: PageProps) {
  const { id } = await params;

  if (!isAdminAuthConfigured()) {
    return (
      <main className="min-h-screen bg-surface-page px-5 py-10 sm:px-6 lg:px-8">
        <section className="mx-auto max-w-3xl rounded-3xl border border-ink-base/10 bg-surface-card/90 p-7 shadow-card-rest sm:p-9">
          <h1 className="text-3xl font-semibold tracking-tight text-ink-strong">Admin Locked</h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-base/72">{adminConfigHelpText()}</p>
        </section>
      </main>
    );
  }

  const adminSession = await getAdminSessionFromPage();
  if (!adminSession) {
    redirect(`/admin/login?next=${encodeURIComponent(`/admin/contentops/${id}/edit`)}`);
  }

  let draft;
  try {
    draft = await getDraftById(id);
  } catch {
    notFound();
  }
  if (!draft) {
    notFound();
  }

  if (draft.status === "published") {
    return (
      <main className="min-h-screen bg-surface-page px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <section className="mx-auto max-w-4xl space-y-6">
          <article className="rounded-3xl border border-tone-amber/25 bg-tone-amber-tint p-7 sm:p-9">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-tone-amber-deep">
              Cannot edit
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink-strong sm:text-3xl">
              This draft is already published
            </h1>
            <p className="mt-3 text-sm text-ink-base/72">
              Published posts are live for readers and are not edited in place from here.
            </p>
            <Link
              href={`/admin/contentops/${draft.id}`}
              className="mt-5 inline-flex rounded-full border border-ink-base/14 bg-surface-raised px-4 py-2 text-sm font-medium text-ink-walnut hover:bg-surface-hover"
            >
              Back to draft review
            </Link>
          </article>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-surface-page px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <section className="mx-auto max-w-4xl space-y-6">
        <header className="rounded-3xl border border-ink-base/10 bg-surface-card/90 p-5 shadow-card-rest sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-ink-base/50">
                Private Admin
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink-strong sm:text-3xl">
                Edit draft
              </h1>
              <p className="mt-2 text-sm text-ink-base/70">
                Fix the draft in place — no reject-and-regenerate needed.
                {draft.status === "rejected"
                  ? " Saving revives this rejected draft back to pending review."
                  : null}
              </p>
            </div>
            <AdminSectionNav
              active="contentops"
              extraActions={
                <Link
                  href={`/admin/contentops/${draft.id}`}
                  className="rounded-full border border-ink-base/14 bg-surface-raised px-3.5 py-1.5 text-xs font-medium text-ink-walnut hover:bg-surface-hover"
                >
                  Back to review
                </Link>
              }
            />
          </div>
        </header>

        <DraftEditor
          draftId={draft.id}
          initialContent={draft.content}
          saveHref={`/api/admin/contentops/drafts/${draft.id}/edit`}
          backHref={`/admin/contentops/${draft.id}`}
        />
      </section>
    </main>
  );
}
