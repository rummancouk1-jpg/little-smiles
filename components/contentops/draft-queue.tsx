// Engine component — presentational draft queue. Server component.
// Renders premium queue cards with status badges, derived signal badges
// (missing image, thin content, missing internal links, missing meta),
// and filter pills. Wiring layer supplies the hrefs.

import Link from "next/link";

import { validateDraft, type DraftBadge } from "@/lib/contentops/draft-validation";
import {
  DRAFT_STATUSES,
  type Draft,
  type DraftStatus,
  type DraftStatusCounts,
} from "@/lib/contentops/drafts-store";

type DraftQueueProps = {
  /** Visible drafts after applying the activeStatus filter. */
  drafts: Draft[];
  /** Total counts from the full drafts table — independent of the active filter. */
  counts: DraftStatusCounts;
  activeStatus: DraftStatus | "all";
  baseHref: string;
  detailHref: (id: string) => string;
};

const STATUS_LABELS: Record<DraftStatus, string> = {
  pending_review: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
  published: "Published",
};

const STATUS_TONE: Record<DraftStatus, string> = {
  pending_review: "bg-[#E7EEF7] text-[#1F3F66]",
  approved: "bg-[#E7F4EA] text-[#2E6A41]",
  rejected: "bg-[#FBEEDE] text-[#7A4A12]",
  published: "bg-[#EEE4DB] text-[#2E2323]",
};

function formatDateTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-PK", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function badgeToneClass(severity: DraftBadge["severity"]): string {
  if (severity === "critical") return "bg-[#F8E8EA] text-[#8A2F40]";
  if (severity === "warning") return "bg-[#FBEEDE] text-[#7A4A12]";
  if (severity === "info") return "bg-[#E7EEF7] text-[#1F3F66]";
  return "bg-[#E7F4EA] text-[#2E6A41]";
}

export function DraftQueue({ drafts, counts, activeStatus, baseHref, detailHref }: DraftQueueProps) {
  const pillClass = (status: DraftStatus | "all") =>
    [
      "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
      activeStatus === status
        ? "bg-[#2F2624] text-[#F6F1EC]"
        : "border border-[#3B2F2F]/14 bg-white/75 text-[#2E2323] hover:border-[#3B2F2F]/24 hover:bg-[#F2EAE4]",
    ].join(" ");
  const countChip = (active: boolean) =>
    [
      "rounded-full px-2 py-0.5 text-[10px] tabular-nums",
      active ? "bg-[#F6F1EC]/20 text-[#F6F1EC]" : "bg-[#EEE4DB] text-[#2E2323]",
    ].join(" ");

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Link href={baseHref} className={pillClass("all")}>
          All <span className={countChip(activeStatus === "all")}>{counts.all}</span>
        </Link>
        {DRAFT_STATUSES.map((status) => (
          <Link key={status} href={`${baseHref}?status=${status}`} className={pillClass(status)}>
            {STATUS_LABELS[status]}{" "}
            <span className={countChip(activeStatus === status)}>{counts[status]}</span>
          </Link>
        ))}
      </div>

      {drafts.length === 0 ? (
        <article className="rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-7 text-sm text-[#3B2F2F]/72 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-9">
          No drafts{" "}
          {activeStatus === "all"
            ? "yet."
            : `in ${STATUS_LABELS[activeStatus as DraftStatus].toLowerCase()}.`}
        </article>
      ) : (
        <div className="grid gap-3">
          {drafts.map((draft) => {
            const validation = validateDraft(draft);
            return (
              <article
                key={draft.id}
                className="rounded-3xl border border-[#3B2F2F]/10 bg-white/90 p-5 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={[
                          "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                          STATUS_TONE[draft.status],
                        ].join(" ")}
                      >
                        {STATUS_LABELS[draft.status]}
                      </span>
                      <span className="text-[11px] text-[#3B2F2F]/60 tabular-nums">
                        {validation.wordCount} words · {validation.sectionCount} sections
                      </span>
                    </div>
                    <Link
                      href={detailHref(draft.id)}
                      className="mt-1 inline-block text-base font-semibold text-[#1F1918] underline-offset-2 hover:underline"
                    >
                      {draft.content.title}
                    </Link>
                    <p className="mt-0.5 text-xs font-mono text-[#3B2F2F]/65">{draft.slug}</p>
                  </div>
                  <div className="text-right text-[11px] text-[#3B2F2F]/60">
                    <p className="uppercase tracking-wide">Created</p>
                    <p className="mt-0.5 text-[#1F1918]">{formatDateTime(draft.created_at)}</p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {validation.badges.map((badge) => (
                    <span
                      key={badge.key}
                      className={[
                        "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                        badgeToneClass(badge.severity),
                      ].join(" ")}
                      title={badge.detail}
                    >
                      {badge.label}
                    </span>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#3B2F2F]/8 pt-3">
                  <Link
                    href={detailHref(draft.id)}
                    className="rounded-full bg-[#2F2624] px-3.5 py-1.5 text-xs font-medium text-[#F6F1EC] hover:opacity-90"
                  >
                    Review draft
                  </Link>
                  {draft.status === "approved" ? (
                    <Link
                      href={`${detailHref(draft.id)}/prepare-publish`}
                      className="rounded-full border border-[#2E6A41]/30 bg-[#E7F4EA] px-3.5 py-1.5 text-xs font-medium text-[#2E6A41] hover:bg-[#D7ECDD]"
                    >
                      Prepare publish →
                    </Link>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
