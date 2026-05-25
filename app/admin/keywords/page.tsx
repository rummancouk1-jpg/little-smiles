import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminSectionNav } from "@/components/admin/admin-section-nav";
import { CopyTextButton } from "@/components/admin/copy-text-button";
import { logSystemAudit } from "@/lib/admin-audit";
import { getAdminSessionFromPage } from "@/lib/admin-auth";
import { adminConfigHelpText, isAdminAuthConfigured } from "@/lib/admin-runtime";
import {
  buildContentBrief,
  buildKeywordOpportunityReport,
  priorityDisplay,
  statusDisplay,
  type KeywordOpportunity,
  type KeywordOpportunityPriority,
  type KeywordOpportunityStatus,
  type KeywordOpportunitySource,
} from "@/lib/seo-intelligence/keyword-opportunities";

export const dynamic = "force-dynamic";

function priorityTone(priority: KeywordOpportunityPriority): string {
  if (priority === "high") return "bg-[#F8E8EA] text-[#8A2F40]";
  if (priority === "medium") return "bg-[#FBEEDE] text-[#7A4A12]";
  return "bg-[#E7EEF7] text-[#1F3F66]";
}

function statusTone(status: KeywordOpportunityStatus): string {
  if (status === "idea") return "bg-[#EEE4DB] text-[#2E2323]";
  if (status === "approved") return "bg-[#E7EEF7] text-[#1F3F66]";
  if (status === "drafted") return "bg-[#FBEEDE] text-[#7A4A12]";
  return "bg-[#E7F4EA] text-[#2E6A41]";
}

function sourceLabel(source: KeywordOpportunitySource): string {
  switch (source) {
    case "local_cluster":
      return "Local cluster";
    case "content_gap":
      return "Content gap";
    case "thin_content":
      return "Thin content";
    case "internal_link_gap":
      return "Internal-link gap";
    case "manual":
      return "Manual";
    case "future_gsc":
      return "Search Console (future)";
    case "future_api":
      return "External API (future)";
  }
}

export default async function KeywordsPage() {
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

  const session = await getAdminSessionFromPage();
  if (!session) {
    redirect("/admin/login?next=%2Fadmin%2Fkeywords");
  }

  const report = await buildKeywordOpportunityReport();

  await logSystemAudit({
    action: "keyword_opportunities_opened",
    actorLabel: session.actorLabel,
    metadata: {
      totalIdeas: report.stats.totalIdeas,
      highPriority: report.stats.byPriority.high,
    },
  }).catch(() => {});

  return (
    <main className="min-h-screen bg-[#FDF8F4] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <section className="mx-auto max-w-5xl space-y-6">
        <header className="rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-5 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#3B2F2F]/50">
                Private Admin
              </p>
              <p className="mt-1 text-xs text-[#3B2F2F]/65">Signed in as {session.actorLabel}</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#1F1918] sm:text-4xl">
                Keyword opportunities
              </h1>
              <p className="mt-1 text-xs text-[#3B2F2F]/65">
                Generated from local site data. No external keyword volume / CPC / difficulty was
                consulted.
              </p>
            </div>
            <AdminSectionNav active="keywords" />
          </div>
        </header>

        {/* Honest disclosure banner — required by spec */}
        <section className="rounded-3xl border border-[#7A4A12]/20 bg-[#FBF5EA] p-4 sm:p-5">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#5E4A1C]">
            Keyword Opportunities v1
          </p>
          <p className="mt-2 text-sm text-[#1F1918]">
            This view uses local site data only — your catalog, your blog posts, your internal-link
            graph, and your draft state. Advanced keyword research (search volume, CPC, difficulty,
            competitor SERPs) can be connected later via Search Console or a paid keyword API.
          </p>
          <p className="mt-2 text-xs text-[#3B2F2F]/72">{report.caveat}</p>
        </section>

        {/* Stats strip */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total opportunities" value={report.stats.totalIdeas} />
          <StatCard label="High priority" value={report.stats.byPriority.high} />
          <StatCard label="Idea stage" value={report.stats.byStatus.idea} />
          <StatCard
            label="Drafted / published"
            value={report.stats.byStatus.drafted + report.stats.byStatus.published}
          />
        </section>

        {/* Opportunities table */}
        <section className="rounded-3xl border border-[#3B2F2F]/10 bg-white/90 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#3B2F2F]/55">
                Opportunities ({report.opportunities.length})
              </p>
              <p className="mt-1 text-xs text-[#3B2F2F]/65">
                Idea-stage rows surface first. Each row is verifiable — open the source signal to
                see why it&apos;s here.
              </p>
            </div>
          </div>

          {report.opportunities.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-[#2E6A41]/20 bg-[#EAF5EE] p-4 text-sm text-[#1E5A37]">
              No opportunities surfaced from local data. Your clusters, internal-link graph, and
              content depth all look healthy.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {report.opportunities.map((op) => (
                <OpportunityRow key={op.id} op={op} />
              ))}
            </ul>
          )}
        </section>
      </section>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[#3B2F2F]/10 bg-white p-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#3B2F2F]/55">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-[#1F1918]">{value}</p>
    </div>
  );
}

function OpportunityRow({ op }: { op: KeywordOpportunity }) {
  const brief = buildContentBrief(op);

  return (
    <li className="rounded-2xl border border-[#3B2F2F]/10 bg-[#FDF8F4] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${priorityTone(op.priority)}`}
            >
              {priorityDisplay(op.priority)}
            </span>
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${statusTone(op.status)}`}
            >
              {statusDisplay(op.status)}
            </span>
            <span className="inline-flex rounded-full bg-white px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#2E2323]">
              {sourceLabel(op.source)}
            </span>
            <span className="inline-flex rounded-full bg-white px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#2E2323]">
              {op.intent}
            </span>
          </div>
          <p className="mt-2 text-sm font-semibold text-[#1F1918]">{op.suggestedTitle}</p>
          <p className="mt-1 font-mono text-xs text-[#3B2F2F]/72">{op.keyword}</p>
          {op.targetProductName ? (
            <p className="mt-1 text-[11px] text-[#3B2F2F]/65">
              Target product:{" "}
              <Link
                href={`/shop/${op.targetProductSlug}`}
                className="underline decoration-[#3B2F2F]/30 underline-offset-2 hover:text-[#1F1918]"
              >
                {op.targetProductName}
              </Link>
            </p>
          ) : op.targetCategory ? (
            <p className="mt-1 text-[11px] text-[#3B2F2F]/65">
              Target category: <span className="font-medium text-[#1F1918]">{op.targetCategory}</span>
            </p>
          ) : null}
          <p className="mt-2 text-xs text-[#3B2F2F]/72">Why: {op.reason}</p>
          {op.linkedDraftId ? (
            <p className="mt-1 text-[11px] text-[#3B2F2F]/65">
              Linked draft:{" "}
              <Link
                href={`/admin/contentops/${op.linkedDraftId}`}
                className="underline decoration-[#3B2F2F]/30 underline-offset-2 hover:text-[#1F1918]"
              >
                {op.linkedDraftSlug ?? op.linkedDraftId}
              </Link>
            </p>
          ) : op.linkedPostSlug ? (
            <p className="mt-1 text-[11px] text-[#3B2F2F]/65">
              Linked post:{" "}
              <Link
                href={`/blog/${op.linkedPostSlug}`}
                className="underline decoration-[#3B2F2F]/30 underline-offset-2 hover:text-[#1F1918]"
              >
                /blog/{op.linkedPostSlug}
              </Link>
            </p>
          ) : null}
        </div>

        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <CopyTextButton
            text={brief}
            label="Copy content brief"
            auditAction="keyword_brief_copied"
            auditMetadata={{
              opportunityId: op.id,
              keyword: op.keyword,
              source: op.source,
              priority: op.priority,
            }}
          />
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="rounded-full border border-[#3B2F2F]/14 bg-white px-3.5 py-1.5 text-xs font-medium text-[#3B2F2F]/45"
            title="Disabled — there is no draft-creation API in this build. Copy the brief above and start a draft through the existing ContentOps pipeline."
          >
            Create draft from keyword (off)
          </button>
        </div>
      </div>

      {/* Outline + FAQ + links preview */}
      <details className="mt-3">
        <summary className="cursor-pointer text-[11px] font-medium uppercase tracking-wide text-[#2E2323]">
          Preview brief
        </summary>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-white p-3 text-xs">
            <p className="font-medium text-[#1F1918]">Outline (H2s)</p>
            <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-[#3B2F2F]/82">
              {op.suggestedOutline.map((h, i) => (
                <li key={i}>{h}</li>
              ))}
            </ol>
          </div>
          <div className="rounded-xl bg-white p-3 text-xs">
            <p className="font-medium text-[#1F1918]">FAQ ideas</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[#3B2F2F]/82">
              {op.suggestedFaqs.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl bg-white p-3 text-xs sm:col-span-2">
            <p className="font-medium text-[#1F1918]">Internal links + CTA</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 font-mono text-[#3B2F2F]/82">
              {op.suggestedInternalLinks.map((l) => (
                <li key={l}>{l}</li>
              ))}
              <li>
                {op.suggestedCta.label} → {op.suggestedCta.href}
              </li>
            </ul>
          </div>
        </div>
      </details>
    </li>
  );
}
