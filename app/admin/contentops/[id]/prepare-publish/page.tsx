import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AdminSectionNav } from "@/components/admin/admin-section-nav";
import { PublishControlPanel } from "@/components/contentops/publish-control-panel";
import { PublishReadinessBanner } from "@/components/contentops/publish-readiness-banner";
import { PublishSafetyCard } from "@/components/contentops/publish-safety-card";
import { littleSmilesPublishAdapter } from "@/lib/blog-publish-adapter";
import { logSystemAudit } from "@/lib/admin-audit";
import { getAdminSessionFromPage } from "@/lib/admin-auth";
import { adminConfigHelpText, isAdminAuthConfigured } from "@/lib/admin-runtime";
import { validateDraft } from "@/lib/contentops/draft-validation";
import { getDraftById } from "@/lib/contentops/drafts-store";
import { buildHeroImageWorkflow } from "@/lib/contentops/hero-image";
import { preparePublish } from "@/lib/contentops/publish-prep";
import { computePublishSafetyScore } from "@/lib/contentops/publish-score";

type PageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export default async function PreparePublishPage({ params }: PageProps) {
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
    redirect(
      `/admin/login?next=${encodeURIComponent(`/admin/contentops/${id}/prepare-publish`)}`,
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
    return (
      <main className="min-h-screen bg-surface-page px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <section className="mx-auto max-w-4xl space-y-6">
          <article className="rounded-3xl border border-tone-amber/25 bg-tone-amber-tint p-7 sm:p-9">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-tone-amber-deep">
              Cannot prepare for publish
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink-strong sm:text-3xl">
              Draft is {draft.status.replace("_", " ")}
            </h1>
            <p className="mt-3 text-sm text-ink-base/72">
              Publish preparation is only available for drafts in approved status. Approve the
              draft first or return to its detail view.
            </p>
            <Link
              href={`/admin/contentops/${id}`}
              className="mt-4 inline-block rounded-full border border-ink-base/14 bg-surface-raised px-4 py-2 text-xs font-medium text-ink-walnut hover:bg-surface-hover"
            >
              Back to draft
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

  const validation = validateDraft(draft);
  const heroWorkflow = await buildHeroImageWorkflow(draft);
  const safetyScore = computePublishSafetyScore(draft, {
    validation,
    publishPrepConflictCodes: preparation?.conflicts.map((c) => c.code) ?? [],
  });

  await logSystemAudit({
    action: "prepare_publish_opened",
    actorLabel: adminSession.actorLabel,
    targetType: "contentops_draft",
    targetId: draft.id,
    metadata: {
      slug: draft.slug,
      verdict: safetyScore.verdict,
      score: safetyScore.score,
    },
  }).catch(() => {});

  return (
    <main className="min-h-screen bg-surface-page px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <section className="mx-auto max-w-4xl space-y-6">
        <header className="rounded-3xl border border-ink-base/10 bg-surface-card/90 p-5 shadow-card-rest sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-ink-base/50">
                Private Admin
              </p>
              <p className="mt-1 text-xs text-ink-base/65">
                Signed in as {adminSession.actorLabel}
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink-strong sm:text-3xl">
                Prepare publish
              </h1>
            </div>
            <AdminSectionNav
              active="contentops"
              extraActions={
                <Link
                  href={`/admin/contentops/${id}`}
                  className="rounded-full border border-ink-base/14 bg-surface-raised px-3.5 py-1.5 text-xs font-medium text-ink-walnut hover:bg-surface-hover"
                >
                  ← Back to draft
                </Link>
              }
            />
          </div>
        </header>

        <PublishReadinessBanner
          verdict={safetyScore.verdict}
          badges={validation.badges}
          improveHref={`/admin/contentops/${draft.id}/improve`}
          publishWarnings={(preparation?.conflicts ?? []).map((c) => ({
            code: c.code,
            message: c.message,
            severity: c.severity,
          }))}
        />

        <PublishSafetyCard score={safetyScore} />

        {prepError ? (
          <article className="rounded-3xl border border-tone-danger/25 bg-emphasis-berry-tint p-5 text-sm text-tone-danger sm:p-6">
            <p className="font-medium">Unable to prepare publish</p>
            <p className="mt-1 text-xs">{prepError}</p>
          </article>
        ) : preparation ? (
          <PublishControlPanel
            preparation={preparation}
            validation={{
              badges: validation.badges,
              wordCount: validation.wordCount,
              sectionCount: validation.sectionCount,
              internalLinkCount: validation.internalLinkCount,
              hasAnchorProduct: validation.hasAnchorProduct,
              anchorImagePath: validation.anchorImagePath,
              publishReady: validation.publishReady,
            }}
            fallbackHeroImagePath={heroWorkflow.autoResolvedPath}
            readinessVerdict={safetyScore.verdict}
            publishHref={`/api/admin/contentops/drafts/${draft.id}/publish`}
          />
        ) : null}
      </section>
    </main>
  );
}
