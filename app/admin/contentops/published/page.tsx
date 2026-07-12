import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminSectionNav } from "@/components/admin/admin-section-nav";
import { StatusPill } from "@/components/contentops/contentops-ui";
import { getAdminSessionFromPage } from "@/lib/admin-auth";
import { adminConfigHelpText, isAdminAuthConfigured } from "@/lib/admin-runtime";
import { listDrafts, type Draft } from "@/lib/contentops/drafts-store";

export const dynamic = "force-dynamic";

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-PK", { year: "numeric", month: "short", day: "2-digit" });
}

export default async function ContentOpsPublishedPage() {
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
    redirect(`/admin/login?next=${encodeURIComponent("/admin/contentops/published")}`);
  }

  let published: Draft[] = [];
  let listError: string | null = null;
  try {
    published = await listDrafts("published");
  } catch (err) {
    listError = err instanceof Error ? err.message : "Failed to load published posts.";
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
                Published posts
              </h1>
              <p className="mt-1 text-xs text-ink-base/65">
                Every post that has gone live. These have left the review queue — nothing here needs action.
              </p>
            </div>
            <AdminSectionNav
              active="contentops"
              extraActions={
                <Link
                  href="/admin/contentops"
                  className="rounded-full border border-ink-base/14 bg-surface-raised px-3.5 py-1.5 text-xs font-medium text-ink-walnut hover:bg-surface-hover"
                >
                  ← Back to queue
                </Link>
              }
            />
          </div>
        </header>

        {listError ? (
          <article className="rounded-3xl border border-tone-danger/25 bg-emphasis-berry-tint p-5 text-sm text-tone-danger sm:p-6">
            <p className="font-medium">Unable to load published posts</p>
            <p className="mt-1 text-xs">{listError}</p>
          </article>
        ) : published.length === 0 ? (
          <article className="rounded-3xl border border-ink-base/10 bg-surface-card/90 p-7 text-sm text-ink-base/72 shadow-card-rest sm:p-9">
            No published posts yet — approve and publish a draft from the queue and it will appear here.
          </article>
        ) : (
          <div className="grid gap-3">
            {published.map((draft) => (
              <article
                key={draft.id}
                className="rounded-3xl border border-ink-base/10 bg-surface-card/90 p-5 shadow-card-rest sm:p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill status={draft.status} />
                      <span className="text-[11px] text-ink-base/60">Published {formatDate(draft.published_at)}</span>
                    </div>
                    <Link
                      href={`/admin/contentops/${draft.id}`}
                      className="mt-2 inline-block font-heading text-lg font-semibold text-ink-strong underline-offset-2 hover:underline"
                    >
                      {draft.content.title}
                    </Link>
                    <p className="mt-0.5 font-mono text-xs text-ink-base/60">{draft.slug}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/admin/contentops/${draft.id}`}
                      className="rounded-full bg-ink-walnut px-3.5 py-1.5 text-xs font-medium text-ink-foreground hover:bg-ink-espresso"
                    >
                      View draft
                    </Link>
                    <Link
                      href={`/blog/${draft.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-ink-base/14 bg-surface-raised px-3.5 py-1.5 text-xs font-medium text-ink-walnut hover:bg-surface-hover"
                    >
                      View live ↗
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
