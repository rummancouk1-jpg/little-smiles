import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AdminSectionNav } from "@/components/admin/admin-section-nav";
import { DraftImprovementPanel } from "@/components/contentops/draft-improvement-panel";
import { ImagePromptsPanel } from "@/components/contentops/image-prompts-panel";
import { logSystemAudit } from "@/lib/admin-audit";
import { getAdminSessionFromPage } from "@/lib/admin-auth";
import { adminConfigHelpText, isAdminAuthConfigured } from "@/lib/admin-runtime";
import { getDraftById } from "@/lib/contentops/drafts-store";
import { buildDraftImprovementReport } from "@/lib/contentops/improvement";
import { buildDraftImagePrompts } from "@/lib/contentops/image-prompts";

type PageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export default async function ImproveDraftPage({ params }: PageProps) {
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
    redirect(`/admin/login?next=${encodeURIComponent(`/admin/contentops/${id}/improve`)}`);
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

  const report = buildDraftImprovementReport(draft);
  const imagePrompts = buildDraftImagePrompts(draft);

  await logSystemAudit({
    action: "improve_draft_opened",
    actorLabel: adminSession.actorLabel,
    targetType: "contentops_draft",
    targetId: draft.id,
    metadata: { slug: draft.slug },
  }).catch(() => {});

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
                Improve draft
              </h1>
              <p className="mt-1 text-xs text-[#3B2F2F]/65">
                Recommendations are computed from this site&apos;s own catalog, blog, and link graph —
                no AI calls, no third-party metrics, no estimates.
              </p>
            </div>
            <AdminSectionNav
              active="contentops"
              extraActions={
                <Link
                  href={`/admin/contentops/${id}`}
                  className="rounded-full border border-[#3B2F2F]/14 bg-white px-3.5 py-1.5 text-xs font-medium text-[#2E2323] hover:bg-[#F2EAE4]"
                >
                  ← Back to draft
                </Link>
              }
            />
          </div>
        </header>

        <DraftImprovementPanel
          report={report}
          draftId={draft.id}
          draftSlug={draft.slug}
          draftTitle={draft.content.title}
          draftRelatedCategory={draft.content.relatedProductCategory}
        />

        <ImagePromptsPanel prompts={imagePrompts} draftId={draft.id} draftSlug={draft.slug} />
      </section>
    </main>
  );
}
