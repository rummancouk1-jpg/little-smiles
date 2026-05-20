// Operational analytics surface. Calm, list-driven, no enterprise-style
// dashboard chrome. Five panels — top traffic, missing assets, no inbound
// links, most-linked, cluster cadence — designed to answer "what needs
// work right now" rather than "how am I trending."
//
// External analytics (GA4 + GSC) are optional: when not configured the
// panels render a one-line "Configure GA4 to see this" hint and the
// rest of the page continues to be useful from the derived internal
// signals alone.

import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminLogoutButton } from "@/components/admin/admin-logout-button";
import { getAdminSessionFromPage } from "@/lib/admin-auth";
import { adminConfigHelpText, isAdminAuthConfigured } from "@/lib/admin-runtime";
import { getAllBlogPosts } from "@/lib/blog";
import { ga4Adapter } from "@/lib/contentops/analytics/ga4";
import { gscAdapter } from "@/lib/contentops/analytics/gsc";
import type {
  TopPagePoint,
  TopQueryPoint,
} from "@/lib/contentops/analytics/types";
import {
  computeArticleHealth,
  computeClusterCadence,
  type ArticleHealthRow,
} from "@/lib/contentops/intelligence/content-health";
import { products } from "@/lib/products";

export const dynamic = "force-dynamic";

function PanelCard({
  title,
  helper,
  children,
}: {
  title: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <article className="rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-5 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-7">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#3B2F2F]/55">
        {title}
      </p>
      {helper ? <p className="mt-1 text-xs text-[#3B2F2F]/65">{helper}</p> : null}
      <div className="mt-3">{children}</div>
    </article>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-[#3B2F2F]/14 bg-[#FBF7F3] p-3 text-xs text-[#3B2F2F]/65">
      {children}
    </p>
  );
}

function ArticleLine({
  href,
  title,
  trailing,
}: {
  href: string;
  title: string;
  trailing?: string;
}) {
  return (
    <li className="flex items-baseline justify-between gap-3 border-b border-[#3B2F2F]/8 py-2 last:border-b-0">
      <Link
        href={href}
        target="_blank"
        className="text-sm text-[#1F1918] underline-offset-2 hover:underline"
      >
        {title}
      </Link>
      {trailing ? (
        <span className="text-xs text-[#3B2F2F]/65">{trailing}</span>
      ) : null}
    </li>
  );
}

export default async function ContentOpsAnalyticsPage() {
  if (!isAdminAuthConfigured()) {
    return (
      <main className="min-h-screen bg-[#FDF8F4] px-5 py-10 sm:px-6 lg:px-8">
        <section className="mx-auto max-w-3xl rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-7 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-9">
          <h1 className="text-3xl font-semibold tracking-tight text-[#1F1918]">Admin Locked</h1>
          <p className="mt-3 text-sm leading-relaxed text-[#3B2F2F]/72">
            {adminConfigHelpText()}
          </p>
        </section>
      </main>
    );
  }

  const adminSession = await getAdminSessionFromPage();
  if (!adminSession) {
    redirect(
      `/admin/login?next=${encodeURIComponent("/admin/contentops/analytics")}`,
    );
  }

  const articles = await getAllBlogPosts().catch(() => []);
  const health: ArticleHealthRow[] = articles.length
    ? computeArticleHealth({ articles, products })
    : [];
  const healthBySlug = new Map(health.map((row) => [row.slug, row]));

  const cadence = articles.length ? computeClusterCadence(articles) : [];
  const missingHero = health.filter((r) => !r.hasHero);
  const noInboundLinks = health
    .filter((r) => r.inboundLinkCount === 0)
    .sort((a, b) => b.potentialInlineLinkCount - a.potentialInlineLinkCount);
  const mostLinked = [...health].sort((a, b) => b.inboundLinkCount - a.inboundLinkCount);

  // External fetches — parallel, all degrade to []
  const [ga4TopPages, gscTopQueries] = (await Promise.all([
    ga4Adapter.isConfigured()
      ? ga4Adapter.topPages({ days: 28, limit: 10 }).catch(() => [] as TopPagePoint[])
      : Promise.resolve([] as TopPagePoint[]),
    gscAdapter.isConfigured()
      ? gscAdapter.topQueries({ days: 28, limit: 10 }).catch(() => [] as TopQueryPoint[])
      : Promise.resolve([] as TopQueryPoint[]),
  ])) as [TopPagePoint[], TopQueryPoint[]];

  const ga4Configured = ga4Adapter.isConfigured();
  const gscConfigured = gscAdapter.isConfigured();

  return (
    <main className="min-h-screen bg-[#FDF8F4] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <section className="mx-auto max-w-5xl space-y-6">
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
                Operational analytics
              </h1>
              <p className="mt-2 text-sm text-[#3B2F2F]/65">
                Calm signals to point you at the next useful action. Top traffic
                from GA4, top queries from Search Console, and derived health
                signals across the catalog.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/admin/contentops"
                className="rounded-full border border-[#3B2F2F]/14 bg-[#EEE4DB] px-3.5 py-1.5 text-xs font-medium text-[#2E2323] hover:bg-[#E7DBD1]"
              >
                Back to overview
              </Link>
              <AdminLogoutButton />
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <PanelCard
            title="Top traffic posts (28 days)"
            helper="From Google Analytics 4. Indicates which articles are pulling in real readers."
          >
            {!ga4Configured ? (
              <EmptyHint>
                Set <span className="font-mono">GA4_PROPERTY_ID</span> and{" "}
                <span className="font-mono">GA4_BEARER_TOKEN</span> to populate
                this panel.
              </EmptyHint>
            ) : ga4TopPages.length === 0 ? (
              <EmptyHint>
                GA4 returned no data for the last 28 days. Confirm the property
                is recording pageviews.
              </EmptyHint>
            ) : (
              <ul>
                {ga4TopPages.slice(0, 10).map((p) => (
                  <ArticleLine
                    key={p.path}
                    href={p.path}
                    title={p.path}
                    trailing={`${p.views.toLocaleString()} views`}
                  />
                ))}
              </ul>
            )}
          </PanelCard>

          <PanelCard
            title="Top queries (28 days)"
            helper="From Google Search Console. Indicates which intents bring readers to the site."
          >
            {!gscConfigured ? (
              <EmptyHint>
                Set <span className="font-mono">GSC_SITE_URL</span> and{" "}
                <span className="font-mono">GSC_BEARER_TOKEN</span> to populate
                this panel.
              </EmptyHint>
            ) : gscTopQueries.length === 0 ? (
              <EmptyHint>
                Search Console returned no data for the last 28 days. Confirm
                the site property is verified.
              </EmptyHint>
            ) : (
              <ul>
                {gscTopQueries.slice(0, 10).map((q) => (
                  <li
                    key={q.query}
                    className="flex items-baseline justify-between gap-3 border-b border-[#3B2F2F]/8 py-2 last:border-b-0"
                  >
                    <p className="text-sm text-[#1F1918]">{q.query}</p>
                    <span className="text-xs text-[#3B2F2F]/65">
                      {q.clicks} clicks · {q.impressions} impr · pos{" "}
                      {q.position.toFixed(1)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </PanelCard>

          <PanelCard
            title="Articles missing a hero image"
            helper="Hero images lift CTR on social previews and Google rich snippets. Pick one off this list each editorial sweep."
          >
            {missingHero.length === 0 ? (
              <EmptyHint>Every published article has a hero image.</EmptyHint>
            ) : (
              <ul>
                {missingHero.slice(0, 10).map((row) => (
                  <ArticleLine
                    key={row.slug}
                    href={`/blog/${row.slug}`}
                    title={row.title}
                    trailing={row.cluster}
                  />
                ))}
              </ul>
            )}
          </PanelCard>

          <PanelCard
            title="Articles with no inbound links"
            helper="Orphans hurt crawl depth and topical authority. Sorted by how many natural inline-link opportunities they already contain."
          >
            {noInboundLinks.length === 0 ? (
              <EmptyHint>
                Every article has at least one strong-or-medium connection to
                another. The graph is healthy.
              </EmptyHint>
            ) : (
              <ul>
                {noInboundLinks.slice(0, 10).map((row) => (
                  <ArticleLine
                    key={row.slug}
                    href={`/blog/${row.slug}`}
                    title={row.title}
                    trailing={`${row.potentialInlineLinkCount} candidates`}
                  />
                ))}
              </ul>
            )}
          </PanelCard>

          <PanelCard
            title="Most internally-linked articles"
            helper="Your topical anchors. Keep these refreshed; they carry the cluster."
          >
            {mostLinked.length === 0 || mostLinked[0].inboundLinkCount === 0 ? (
              <EmptyHint>
                Not enough articles yet to compute a useful ranking. Ship a few
                more and the anchors will emerge.
              </EmptyHint>
            ) : (
              <ul>
                {mostLinked.slice(0, 5).map((row) => (
                  <ArticleLine
                    key={row.slug}
                    href={`/blog/${row.slug}`}
                    title={row.title}
                    trailing={`${row.inboundLinkCount} inbound`}
                  />
                ))}
              </ul>
            )}
          </PanelCard>

          <PanelCard
            title="Publishing cadence by cluster"
            helper="How long since each cluster received fresh editorial attention."
          >
            {cadence.length === 0 ? (
              <EmptyHint>No articles yet.</EmptyHint>
            ) : (
              <ul>
                {cadence.map((c) => (
                  <li
                    key={c.cluster}
                    className="flex items-baseline justify-between gap-3 border-b border-[#3B2F2F]/8 py-2 last:border-b-0"
                  >
                    <p className="text-sm text-[#1F1918]">{c.cluster}</p>
                    <span className="text-xs text-[#3B2F2F]/65">
                      {c.articleCount} article{c.articleCount === 1 ? "" : "s"}
                      {c.daysSinceLastPublish !== null
                        ? ` · last ${c.daysSinceLastPublish}d ago`
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </PanelCard>
        </div>

        <article className="rounded-3xl border border-[#3B2F2F]/10 bg-[#FBF7F3] p-5 text-xs leading-relaxed text-[#3B2F2F]/72 sm:p-6">
          <p className="font-medium text-[#1F1918]">How this page works</p>
          <p className="mt-1">
            External signals (top traffic, top queries) come from Google
            Analytics 4 and Google Search Console when configured. Derived
            signals (missing assets, link health, cadence) come from your own
            article catalog and never require external credentials.
            {healthBySlug.size > 0
              ? ` Covering ${healthBySlug.size} published article${healthBySlug.size === 1 ? "" : "s"}.`
              : ""}
          </p>
        </article>
      </section>
    </main>
  );
}
