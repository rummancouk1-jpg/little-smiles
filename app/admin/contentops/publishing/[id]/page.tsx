// Operator publish article page. Moved here from
// app/admin/contentops/[id]/prepare-publish in Commit H so the operator's
// surface lives on its own route. Reviewer never lands here.
//
// Engine, adapter, and components are untouched — only the URL changed.

import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AdminLogoutButton } from "@/components/admin/admin-logout-button";
import { ArticlePreview } from "@/components/contentops/article-preview";
import { getStatusLabel } from "@/components/contentops/labels";
import { PublishAction } from "@/components/contentops/publish-action";
import { PublishReport } from "@/components/contentops/publish-report";
import { littleSmilesPublishAdapter } from "@/lib/blog-publish-adapter";
import { getAdminSessionFromPage } from "@/lib/admin-auth";
import { adminConfigHelpText, isAdminAuthConfigured } from "@/lib/admin-runtime";
import { getDraftById } from "@/lib/contentops/drafts-store";
import { preparePublish } from "@/lib/contentops/publish-prep";

type PageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export default async function PublishArticlePage({ params }: PageProps) {
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
    redirect(
      `/admin/login?next=${encodeURIComponent(`/admin/contentops/publishing/${id}`)}`,
    );
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

  if (draft.status !== "approved") {
    const isPublished = draft.status === "published";
    const bannerPalette = isPublished
      ? "border-[#2E6A41]/20 bg-[#EAF5EE]"
      : "border-[#8A6A2F]/20 bg-[#FBF5EA]";
    const bannerLabelClass = isPublished ? "text-[#1E5A37]" : "text-[#5E4A1C]";
    const headline = isPublished
      ? "This article is live on the site."
      : `Status: ${getStatusLabel(draft.status)}`;
    const explanation = isPublished
      ? "The article has already shipped. No further publish action is possible from this view."
      : "Publishing is only available once a draft has been approved. The reviewer must approve it first.";
    return (
      <main className="min-h-screen bg-[#FDF8F4] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <section className="mx-auto max-w-4xl space-y-6">
          <article className={`rounded-3xl border p-7 sm:p-9 ${bannerPalette}`}>
            <p className={`text-xs font-medium uppercase tracking-[0.16em] ${bannerLabelClass}`}>
              {isPublished ? "Already live" : "Not ready to publish"}
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#1F1918] sm:text-3xl">
              {headline}
            </h1>
            <p className="mt-3 text-sm text-[#3B2F2F]/72">{explanation}</p>
            <Link
              href="/admin/contentops/publishing"
              className="mt-4 inline-block rounded-full border border-[#3B2F2F]/14 bg-white px-4 py-2 text-xs font-medium text-[#2E2323] hover:bg-[#F2EAE4]"
            >
              Back to publishing queue
            </Link>
          </article>
        </section>
      </main>
    );
  }

  let preparation;
  let prepError: string | null = null;
  try {
    preparation = await preparePublish(draft, littleSmilesPublishAdapter);
  } catch (err) {
    prepError = err instanceof Error ? err.message : "Failed to prepare publish.";
  }

  return (
    <main className="min-h-screen bg-[#FDF8F4] px-4 pb-32 pt-8 sm:px-6 sm:pt-10 lg:px-8">
      <section className="mx-auto max-w-4xl space-y-6">
        <header className="rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-5 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#3B2F2F]/55">
                Operator view
              </p>
              <p className="mt-1 text-xs text-[#3B2F2F]/65">
                Signed in as {adminSession.actorLabel}
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#1F1918] sm:text-3xl">
                Publish article
              </h1>
            </div>
            <Link
              href="/admin/contentops/publishing"
              className="rounded-full border border-[#3B2F2F]/14 bg-[#EEE4DB] px-3.5 py-1.5 text-xs font-medium text-[#2E2323] hover:bg-[#E7DBD1]"
            >
              Back to publishing queue
            </Link>
            <AdminLogoutButton />
          </div>
        </header>

        {prepError ? (
          <article className="rounded-3xl border border-[#8A2F40]/20 bg-[#FBEEF1] p-5 text-sm text-[#5E1C29] sm:p-6">
            <p className="font-medium">Unable to prepare publish</p>
            <p className="mt-1 text-xs">{prepError}</p>
          </article>
        ) : preparation ? (
          <>
            <PublishReport preparation={preparation} />
            <ArticlePreview article={preparation.insertionPreview} />
            <PublishAction
              draftId={draft.id}
              publishHref={`/api/admin/contentops/drafts/${draft.id}/publish`}
              ready={preparation.ready}
            />
          </>
        ) : null}
      </section>
    </main>
  );
}
