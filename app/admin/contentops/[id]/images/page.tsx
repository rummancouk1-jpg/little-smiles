// Operator-facing media management for a single draft. Lists each
// supported image slot (hero, thumbnail) with the current state and an
// inline MediaUploader. Reachable from both the article-review and
// publish surfaces via small "Manage media" links.
//
// Section images: schema-ready (BlogSection.image exists) but the
// editorial workflow is intentionally deferred. The page notes this so
// operators aren't confused about absence.

import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AdminLogoutButton } from "@/components/admin/admin-logout-button";
import { getStatusLabel } from "@/components/contentops/labels";
import { MediaUploader } from "@/components/contentops/media-uploader";
import { getAdminSessionFromPage } from "@/lib/admin-auth";
import { adminConfigHelpText, isAdminAuthConfigured } from "@/lib/admin-runtime";
import { getDraftById } from "@/lib/contentops/drafts-store";

type PageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export default async function ManageMediaPage({ params }: PageProps) {
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
      `/admin/login?next=${encodeURIComponent(`/admin/contentops/${id}/images`)}`,
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

  const isPublished = draft.status === "published";
  const sectionImageCount = draft.content.sections.reduce(
    (acc, section) => acc + (section.image ? 1 : 0),
    0,
  );

  return (
    <main className="min-h-screen bg-[#FDF8F4] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
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
                Manage media
              </h1>
              <p className="mt-2 text-sm text-[#3B2F2F]/65">
                Hero and thumbnail for{" "}
                <span className="font-medium text-[#1F1918]">
                  {draft.content.title}
                </span>
                . Status: {getStatusLabel(draft.status)}.
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
          <article className="rounded-3xl border border-[#2E6A41]/20 bg-[#EAF5EE] p-5 text-sm text-[#1E5A37] sm:p-6">
            <p className="font-medium">This article is live on the site.</p>
            <p className="mt-1 text-xs text-[#1E5A37]/85">
              Live articles cannot have their images modified through the admin. To
              change the imagery, generate a new draft for the same topic.
            </p>
          </article>
        ) : null}

        <MediaUploader
          label="Hero image"
          helperText="Full-width visual anchor at the top of the article. 1600×900 (16:9) works well; 4:3 ratios are also fine."
          current={draft.content.hero ?? null}
          uploadHref={`/api/admin/contentops/drafts/${draft.id}/images/upload`}
          slotHref={`/api/admin/contentops/drafts/${draft.id}/images/hero`}
          disabled={isPublished}
        />

        <MediaUploader
          label="Thumbnail"
          helperText="Smaller representation for blog cards, social previews, and OG metadata. Falls back to the hero when absent."
          current={draft.content.thumbnail ?? null}
          uploadHref={`/api/admin/contentops/drafts/${draft.id}/images/upload`}
          slotHref={`/api/admin/contentops/drafts/${draft.id}/images/thumbnail`}
          disabled={isPublished}
        />

        <article className="rounded-3xl border border-[#3B2F2F]/10 bg-[#FBF7F3] p-5 text-sm text-[#3B2F2F]/72 sm:p-6">
          <p className="font-medium text-[#1F1918]">Section images</p>
          <p className="mt-1 text-xs">
            The article schema supports an optional image per section, and the
            renderer surfaces them when present. The editorial workflow to upload
            section images from the UI is deferred to a later commit so the hero
            and thumbnail flow can prove itself first.
            {sectionImageCount > 0
              ? ` This article currently has ${sectionImageCount} section image${sectionImageCount === 1 ? "" : "s"} (added via API or SQL).`
              : ""}
          </p>
        </article>
      </section>
    </main>
  );
}
