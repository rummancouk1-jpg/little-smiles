import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AdminSectionNav } from "@/components/admin/admin-section-nav";
import { DraftActions } from "@/components/contentops/draft-actions";
import { DraftDetail } from "@/components/contentops/draft-detail";
import { HeroImagePanel } from "@/components/contentops/hero-image-panel";
import { ImagePromptsPanel } from "@/components/contentops/image-prompts-panel";
import { PublishReadinessBanner } from "@/components/contentops/publish-readiness-banner";
import { PublishSafetyCard } from "@/components/contentops/publish-safety-card";
import { WebsitePreview } from "@/components/contentops/website-preview";
import { getAdminSessionFromPage } from "@/lib/admin-auth";
import { adminConfigHelpText, isAdminAuthConfigured } from "@/lib/admin-runtime";
import { validateDraft } from "@/lib/contentops/draft-validation";
import { getDraftById } from "@/lib/contentops/drafts-store";
import { buildHeroImageWorkflow } from "@/lib/contentops/hero-image";
import { buildDraftImagePrompts } from "@/lib/contentops/image-prompts";
import { computePublishSafetyScore } from "@/lib/contentops/publish-score";

type PageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export default async function ContentOpsDraftDetailPage({ params }: PageProps) {
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
    redirect(`/admin/login?next=${encodeURIComponent(`/admin/contentops/${id}`)}`);
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

  const heroWorkflow = await buildHeroImageWorkflow(draft);
  const validation = validateDraft(draft);
  const safetyScore = computePublishSafetyScore(draft, { validation });
  const imagePrompts = buildDraftImagePrompts(draft);

  return (
    <main className="min-h-screen bg-[#FDF8F4] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <section className="mx-auto max-w-4xl space-y-6">
        <header className="rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-5 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#3B2F2F]/50">
                Private Admin
              </p>
              <p className="mt-1 text-xs text-[#3B2F2F]/65">Signed in as {adminSession.actorLabel}</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#1F1918] sm:text-3xl">
                Draft review
              </h1>
            </div>
            <AdminSectionNav
              active="contentops"
              extraActions={
                <>
                  <Link
                    href="/admin/contentops"
                    className="rounded-full border border-[#3B2F2F]/14 bg-white px-3.5 py-1.5 text-xs font-medium text-[#2E2323] hover:bg-[#F2EAE4]"
                  >
                    Back to queue
                  </Link>
                  <Link
                    href={`/admin/contentops/${draft.id}/improve`}
                    className="rounded-full border border-[#7A4A12]/30 bg-[#FBEEDE] px-3.5 py-1.5 text-xs font-medium text-[#7A4A12] hover:bg-[#F4E2C9]"
                  >
                    Improve draft →
                  </Link>
                  {draft.status === "approved" ? (
                    <Link
                      href={`/admin/contentops/${draft.id}/prepare-publish`}
                      className="rounded-full bg-[#2E6A41] px-3.5 py-1.5 text-xs font-medium text-[#F6F1EC] hover:opacity-90"
                    >
                      Prepare publish →
                    </Link>
                  ) : null}
                </>
              }
            />
          </div>
        </header>

        <PublishReadinessBanner
          verdict={safetyScore.verdict}
          badges={validation.badges}
          improveHref={`/admin/contentops/${draft.id}/improve`}
        />

        <PublishSafetyCard score={safetyScore} />

        <DraftDetail draft={draft} />

        <HeroImagePanel draftId={draft.id} workflow={heroWorkflow} />

        <ImagePromptsPanel prompts={imagePrompts} draftId={draft.id} draftSlug={draft.slug} />

        <WebsitePreview
          post={
            draft.hero_image_path
              ? { ...draft.content, heroImage: draft.hero_image_path }
              : draft.content
          }
          fallbackHeroImagePath={heroWorkflow.autoResolvedPath}
        />

        <DraftActions
          draftId={draft.id}
          status={draft.status}
          approveHref={`/api/admin/contentops/drafts/${draft.id}/approve`}
          rejectHref={`/api/admin/contentops/drafts/${draft.id}/reject`}
          backHref="/admin/contentops"
        />
      </section>
    </main>
  );
}
