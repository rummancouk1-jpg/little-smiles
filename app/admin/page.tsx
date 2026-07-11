import Link from "next/link";
import { redirect } from "next/navigation";

import { CollapsibleDetail } from "@/components/admin/collapsible-detail";
import { GlanceSummary, type GlanceAttentionItem } from "@/components/admin/glance-summary";
import { getAdminSessionFromPage } from "@/lib/admin-auth";
import { adminConfigHelpText, isAdminAuthConfigured } from "@/lib/admin-runtime";
import { countDraftsByStatus, type DraftStatusCounts } from "@/lib/contentops/drafts-store";

export const dynamic = "force-dynamic";

const EMPTY: DraftStatusCounts = {
  pending_review: 0,
  approved: 0,
  rejected: 0,
  published: 0,
  all: 0,
};

function SectionLink({ href, children }: { href: string; children: string }) {
  return (
    <Link
      href={href}
      className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-accent-brass/12 px-3 py-1.5 text-xs font-semibold text-accent-brass transition-colors hover:bg-accent-brass/20"
    >
      {children} →
    </Link>
  );
}

export default async function AdminCommandHome() {
  if (!isAdminAuthConfigured()) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <section className="rounded-3xl border border-ink-base/12 bg-surface-card/90 p-7">
          <h1 className="font-heading text-3xl text-ink-strong">Admin Locked</h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">{adminConfigHelpText()}</p>
        </section>
      </main>
    );
  }

  const session = await getAdminSessionFromPage();
  if (!session) redirect("/admin/login?next=%2Fadmin");

  const counts = await countDraftsByStatus().catch(() => ({ ...EMPTY }));
  const pending = counts.pending_review;

  const attention: GlanceAttentionItem[] = [];
  if (pending > 0) {
    attention.push({
      label: `${pending} draft${pending === 1 ? "" : "s"} awaiting review`,
      detail: "Approve or reject in ContentOps",
      href: "/admin/contentops",
      actionLabel: "Review",
      tone: "warn",
    });
  }
  attention.push(
    {
      label: "SEO health, snapshots & link opportunities",
      detail: "Full intelligence report from your own site data",
      href: "/admin/seo",
      actionLabel: "Open",
      tone: "info",
    },
    {
      label: "Keyword opportunities & clusters",
      detail: "Deterministic mining — no scraping",
      href: "/admin/keywords",
      actionLabel: "Open",
      tone: "brass",
    },
  );

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <GlanceSummary
        eyebrow={`Private cockpit · signed in as ${session.actorLabel}`}
        title="Command"
        headline={{
          label: "Drafts in the pipeline",
          value: counts.all,
          grade: `${pending} pending`,
          tone: pending > 0 ? "warn" : "good",
          sublabel:
            "Editorial drafts across every status. Pending items need your review before they can publish.",
        }}
        stats={[
          { label: "Pending", value: counts.pending_review, tone: pending > 0 ? "warn" : "neutral" },
          { label: "Approved", value: counts.approved, tone: "good" },
          { label: "Published", value: counts.published, tone: "info" },
          { label: "Rejected", value: counts.rejected, tone: "neutral" },
        ]}
        attention={attention}
      />

      <section>
        <h2 className="px-1 text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">
          Cockpit sections
        </h2>
        <div className="mt-2 space-y-2.5">
          <CollapsibleDetail
            label="SEO Intelligence"
            meta="Health score · snapshots · link & schema coverage"
            leadingDot="info"
            badge={{ label: "Live", tone: "info" }}
          >
            <p>
              A composite SEO health score across five pillars, Search Console + GA4 snapshot
              trends, internal-link suggestions, and schema coverage — all derived from your own
              repo and connected data. No scraping, no invented numbers.
            </p>
            <SectionLink href="/admin/seo">Open SEO Intelligence</SectionLink>
          </CollapsibleDetail>

          <CollapsibleDetail
            label="ContentOps"
            meta={`${counts.all} draft${counts.all === 1 ? "" : "s"} in the pipeline`}
            leadingDot={pending > 0 ? "warn" : "good"}
            badge={{ label: `${pending} pending`, tone: pending > 0 ? "warn" : "good" }}
          >
            <p>
              {counts.pending_review} pending · {counts.approved} approved · {counts.published}{" "}
              published · {counts.rejected} rejected. Review, improve, and prepare drafts for
              publishing.
            </p>
            <SectionLink href="/admin/contentops">Open ContentOps</SectionLink>
          </CollapsibleDetail>

          <CollapsibleDetail
            label="Keywords"
            meta="Opportunities · clusters · intent"
            leadingDot="brass"
            badge={{ label: "Mining", tone: "brass" }}
          >
            <p>
              Deterministic keyword mining and clustering from your catalog and blog — surfacing
              gaps and opportunities without third-party keyword tools.
            </p>
            <SectionLink href="/admin/keywords">Open Keywords</SectionLink>
          </CollapsibleDetail>

          <CollapsibleDetail
            label="Readiness"
            meta="Pre-publish checks"
            leadingDot="neutral"
            badge={{ label: "Checklist", tone: "neutral" }}
          >
            <p>
              The pre-publish readiness checklist — the gates a draft must clear before it goes
              live.
            </p>
            <SectionLink href="/admin/readiness">Open Readiness</SectionLink>
          </CollapsibleDetail>
        </div>
      </section>
    </main>
  );
}
