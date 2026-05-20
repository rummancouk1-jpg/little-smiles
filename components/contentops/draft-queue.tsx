// Engine component — presentational draft queue. Server component.
// Reviewer-facing: no slug, no UUID, no engineering terminology.

import Link from "next/link";

import { DRAFT_STATUSES, type Draft, type DraftStatus } from "@/lib/contentops/drafts-store";
import { getStatusFilterLabel, getStatusTone } from "@/components/contentops/labels";
import { formatRelativeTime } from "@/components/contentops/relative-time";

type DraftQueueProps = {
  drafts: Draft[];
  activeStatus: DraftStatus | "all";
  baseHref: string;
  detailHref: (id: string) => string;
};

export function DraftQueue({ drafts, activeStatus, baseHref, detailHref }: DraftQueueProps) {
  const pillClass = (status: DraftStatus | "all") =>
    [
      "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
      activeStatus === status
        ? "bg-[#2F2624] text-[#F6F1EC]"
        : "border border-[#3B2F2F]/14 bg-white/75 text-[#2E2323] hover:border-[#3B2F2F]/24 hover:bg-[#F2EAE4]",
    ].join(" ");

  // "Awaiting review" pill links to the bare path so the default landing
  // view is canonical. "All" is opt-in via ?status=all.
  const filterHref = (status: DraftStatus | "all") =>
    status === "pending_review"
      ? baseHref
      : status === "all"
        ? `${baseHref}?status=all`
        : `${baseHref}?status=${status}`;

  const emptyLabel =
    activeStatus === "all"
      ? "Nothing here yet. New AI drafts appear in your queue when generated."
      : activeStatus === "pending_review"
        ? "Nothing in your queue. You're up to date."
        : `No articles ${getStatusFilterLabel(activeStatus).toLowerCase()}.`;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {DRAFT_STATUSES.map((status) => (
          <Link key={status} href={filterHref(status)} className={pillClass(status)}>
            {getStatusFilterLabel(status)}
          </Link>
        ))}
        <Link href={filterHref("all")} className={pillClass("all")}>
          All
        </Link>
      </div>

      {drafts.length === 0 ? (
        <article className="rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-7 text-sm text-[#3B2F2F]/72 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-9">
          {emptyLabel}
        </article>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-[#3B2F2F]/10 bg-white/85 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#FBF7F3] text-xs uppercase tracking-[0.12em] text-[#3B2F2F]/55">
              <tr>
                <th className="px-5 py-3 font-medium">Article</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Drafted</th>
              </tr>
            </thead>
            <tbody>
              {drafts.map((draft) => {
                const tone = getStatusTone(draft.status);
                return (
                  <tr
                    key={draft.id}
                    className="border-t border-[#3B2F2F]/8 transition-colors hover:bg-[#FBF7F3]"
                  >
                    <td className="px-5 py-4">
                      <Link
                        href={detailHref(draft.id)}
                        className="font-medium text-[#1F1918] underline-offset-2 hover:underline"
                      >
                        {draft.content.title}
                      </Link>
                      <p className="mt-1 text-xs text-[#3B2F2F]/65">{draft.content.category}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${tone.pill}`}
                      >
                        {getStatusFilterLabel(draft.status)}
                      </span>
                    </td>
                    <td
                      className="px-5 py-4 text-xs text-[#3B2F2F]/72"
                      title={draft.created_at}
                    >
                      {formatRelativeTime(draft.created_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
