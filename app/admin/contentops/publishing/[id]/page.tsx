// Operator publish article page. Moved here from
// app/admin/contentops/[id]/prepare-publish in Commit H so the operator's
// surface lives on its own route. Reviewer never lands here.
//
// Engine, adapter, and components are untouched — only the URL changed.

import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AdminLogoutButton } from "@/components/admin/admin-logout-button";
import { ArticlePreview } from "@/components/contentops/article-preview";
import { EditorialConnections } from "@/components/contentops/editorial-connections";
import { EditorialSummary } from "@/components/contentops/editorial-summary";
import { InlineLinkSuggestions } from "@/components/contentops/inline-link-suggestions";
import { getStatusLabel } from "@/components/contentops/labels";
import { MediaConfidence } from "@/components/contentops/media-confidence";
import { PublishAction } from "@/components/contentops/publish-action";
import { PublishingDestination } from "@/components/contentops/publishing-destination";
import { ReadinessPanel } from "@/components/contentops/readiness-panel";
import { SerpIntelligenceCard } from "@/components/contentops/serp-intelligence-card";
import { getAllBlogPosts } from "@/lib/blog";
import { littleSmilesPublishAdapter } from "@/lib/blog-publish-adapter";
import { getAdminSessionFromPage } from "@/lib/admin-auth";
import { adminConfigHelpText, isAdminAuthConfigured } from "@/lib/admin-runtime";
import { getDraftById } from "@/lib/contentops/drafts-store";
import {
  computeInlineLinkSuggestions,
  computeLinkingSuggestions,
  type InlineLinkSuggestion,
} from "@/lib/contentops/intelligence/relationships";
import { inferSerpIntelligence } from "@/lib/contentops/intelligence/serp-intelligence";
import { preparePublish } from "@/lib/contentops/publish-prep";
import { products } from "@/lib/products";

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

  const isWorkable = draft.status === "approved" || draft.status === "scheduled";
  if (!isWorkable) {
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
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Link
                href="/admin/contentops/publishing"
                className="inline-block rounded-full border border-[#3B2F2F]/14 bg-white px-4 py-2 text-xs font-medium text-[#2E2323] hover:bg-[#F2EAE4]"
              >
                Back to publishing queue
              </Link>
              {isPublished ? (
                <a
                  href={`/blog/${draft.content.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-[#1E5A37] underline underline-offset-2 hover:text-[#175030]"
                >
                  View live article →
                </a>
              ) : null}
            </div>
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

  // Editorial linking suggestions — pulled in parallel-friendly order
  // after preparation since they depend on the prepared content. Falls
  // back to an empty result if the catalog read fails; the section
  // hides itself when there are no candidates.
  let linkingSuggestions:
    | ReturnType<typeof computeLinkingSuggestions>
    | null = null;
  let inlineLinks: InlineLinkSuggestion[] = [];
  if (preparation) {
    try {
      const allArticles = await getAllBlogPosts();
      linkingSuggestions = computeLinkingSuggestions({
        article: preparation.insertionPreview,
        candidates: allArticles,
        products,
      });
      inlineLinks = computeInlineLinkSuggestions({
        article: preparation.insertionPreview,
        candidates: allArticles,
        products,
        maxLinks: 4,
        maxProductLinks: 2,
      });
    } catch {
      linkingSuggestions = null;
      inlineLinks = [];
    }
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
              href={`/admin/contentops/${draft.id}/images`}
              className="text-xs text-[#3B2F2F]/55 underline underline-offset-2 hover:text-[#3B2F2F]"
            >
              Manage media →
            </Link>
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
            <PublishingDestination
              draft={preparation.draft}
              preparedAt={preparation.preparedAt}
              ready={preparation.ready}
            />
            <EditorialSummary post={preparation.insertionPreview} />
            <ReadinessPanel readiness={preparation.readiness} />
            <MediaConfidence
              hero={preparation.insertionPreview.hero ?? null}
              thumbnail={preparation.insertionPreview.thumbnail ?? null}
              draftId={preparation.draft.id}
            />
            {linkingSuggestions ? (
              <EditorialConnections suggestions={linkingSuggestions} />
            ) : null}
            <SerpIntelligenceCard
              report={inferSerpIntelligence({
                post: preparation.insertionPreview,
              })}
            />
            <InlineLinkSuggestions suggestions={inlineLinks} />
            <ArticlePreview article={preparation.insertionPreview} />
            <PublishAction
              draftId={draft.id}
              status={draft.status === "scheduled" ? "scheduled" : "approved"}
              scheduledAt={draft.scheduled_at}
              ready={preparation.ready}
              publishHref={`/api/admin/contentops/drafts/${draft.id}/publish`}
              scheduleHref={`/api/admin/contentops/drafts/${draft.id}/schedule`}
              unscheduleHref={`/api/admin/contentops/drafts/${draft.id}/unschedule`}
            />
          </>
        ) : null}
      </section>
    </main>
  );
}
