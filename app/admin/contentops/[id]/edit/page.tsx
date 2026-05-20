// Operator-facing edit page. Hosts the calm DraftEditForm and lets the
// operator refine title, description, sections, CTA, keywords, and
// metadata before publishing. Frozen drafts (status='published')
// render a calm explanation instead of the form — live articles can't
// be retroactively edited through this surface.

import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AdminLogoutButton } from "@/components/admin/admin-logout-button";
import { DraftEditForm } from "@/components/contentops/draft-edit-form";
import { getStatusLabel } from "@/components/contentops/labels";
import { getAdminSessionFromPage } from "@/lib/admin-auth";
import { adminConfigHelpText, isAdminAuthConfigured } from "@/lib/admin-runtime";
import { getDraftById } from "@/lib/contentops/drafts-store";

type PageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export default async function EditDraftPage({ params }: PageProps) {
  const { id } = await params;

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

  const isPublished = draft.status === "published";

  return (
    <main className="min-h-screen bg-[#FDF8F4] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <section className="mx-auto max-w-4xl space-y-6">
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
                Edit article
              </h1>
              <p className="mt-2 text-sm text-[#3B2F2F]/65">
                Refine the draft. Edits are saved as a revision — the article keeps
                its current status.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={`/admin/contentops/${id}`}
                className="rounded-full border border-[#3B2F2F]/14 bg-[#EEE4DB] px-3.5 py-1.5 text-xs font-medium text-[#2E2323] hover:bg-[#E7DBD1]"
              >
                Back to article
              </Link>
              <AdminLogoutButton />
            </div>
          </div>
        </header>

        {isPublished ? (
          <article className="rounded-3xl border border-[#2E6A41]/20 bg-[#EAF5EE] p-7 sm:p-9">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#1E5A37]">
              This article is live on the site
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#1F1918] sm:text-3xl">
              {draft.content.title}
            </h2>
            <p className="mt-3 text-sm text-[#1E5A37]/85">
              Status: {getStatusLabel(draft.status)}. Live articles aren&rsquo;t
              editable through this surface — generate a new draft for the same
              topic to replace it.
            </p>
            <Link
              href={`/admin/contentops/${id}`}
              className="mt-4 inline-block rounded-full border border-[#3B2F2F]/14 bg-white px-4 py-2 text-xs font-medium text-[#2E2323] hover:bg-[#F2EAE4]"
            >
              Back to article
            </Link>
          </article>
        ) : (
          <DraftEditForm
            draftId={draft.id}
            initial={draft.content}
            draftStatus={draft.status}
            scheduledAt={draft.scheduled_at}
          />
        )}
      </section>
    </main>
  );
}
