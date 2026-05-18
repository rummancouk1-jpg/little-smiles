// Engine component — presentational draft queue. Server component.
// No project-specific imports or copy.

import Link from "next/link";

import { DRAFT_STATUSES, type Draft, type DraftStatus } from "@/lib/contentops/drafts-store";

type DraftQueueProps = {
  drafts: Draft[];
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

export function DraftQueue({ drafts, activeStatus, baseHref, detailHref }: DraftQueueProps) {
  const pillClass = (status: DraftStatus | "all") =>
    [
      "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
      activeStatus === status
        ? "bg-[#2F2624] text-[#F6F1EC]"
        : "border border-[#3B2F2F]/14 bg-white/75 text-[#2E2323] hover:border-[#3B2F2F]/24 hover:bg-[#F2EAE4]",
    ].join(" ");

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Link href={baseHref} className={pillClass("all")}>
          All
        </Link>
        {DRAFT_STATUSES.map((status) => (
          <Link key={status} href={`${baseHref}?status=${status}`} className={pillClass(status)}>
            {STATUS_LABELS[status]}
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
        <div className="overflow-hidden rounded-3xl border border-[#3B2F2F]/10 bg-white/85 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#FBF7F3] text-xs uppercase tracking-[0.12em] text-[#3B2F2F]/55">
              <tr>
                <th className="px-5 py-3 font-medium">Title</th>
                <th className="px-5 py-3 font-medium">Slug</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {drafts.map((draft) => (
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
                  </td>
                  <td className="px-5 py-4 font-mono text-xs text-[#3B2F2F]/72">{draft.slug}</td>
                  <td className="px-5 py-4 text-xs text-[#3B2F2F]/85">
                    {STATUS_LABELS[draft.status]}
                  </td>
                  <td className="px-5 py-4 text-xs text-[#3B2F2F]/72">
                    {formatDateTime(draft.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
