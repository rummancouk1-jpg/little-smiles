// Engine component — operator-facing queue. Lists drafts that are
// approved (ready to publish) or already published (historical). The
// reviewer never lands here; her surface remains at /admin/contentops.
//
// Separate component from DraftQueue because the table shape differs:
// operator cares about "ready since" + status; reviewer cares about
// "drafted" + status. Reusing one component with branching props would
// muddle both.

import Link from "next/link";

import { type Draft, type DraftStatus } from "@/lib/contentops/drafts-store";
import { getStatusTone } from "@/components/contentops/labels";
import { formatRelativeTime } from "@/components/contentops/relative-time";

export type OperatorFilter = "approved" | "published" | "all";

type PublishingQueueProps = {
  drafts: Draft[];
  activeFilter: OperatorFilter;
  baseHref: string;
  detailHref: (id: string) => string;
};

const FILTER_LABELS: Record<OperatorFilter, string> = {
  approved: "Ready",
  published: "Live",
  all: "All",
};

const FILTER_ORDER: OperatorFilter[] = ["approved", "published", "all"];

const STATUS_PILL_LABEL: Record<Extract<DraftStatus, "approved" | "published">, string> = {
  approved: "Ready",
  published: "Live",
};

function readySinceTimestamp(draft: Draft): string {
  if (draft.status === "published" && draft.published_at) return draft.published_at;
  if (draft.status === "approved" && draft.approved_at) return draft.approved_at;
  return draft.created_at;
}

export function PublishingQueue({
  drafts,
  activeFilter,
  baseHref,
  detailHref,
}: PublishingQueueProps) {
  const pillClass = (filter: OperatorFilter) =>
    [
      "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
      activeFilter === filter
        ? "bg-[#2F2624] text-[#F6F1EC]"
        : "border border-[#3B2F2F]/14 bg-white/75 text-[#2E2323] hover:border-[#3B2F2F]/24 hover:bg-[#F2EAE4]",
    ].join(" ");

  // "Ready" is the canonical default and links to the bare path.
  const filterHref = (filter: OperatorFilter) =>
    filter === "approved" ? baseHref : `${baseHref}?filter=${filter}`;

  const emptyLabel =
    activeFilter === "approved"
      ? "All caught up. Articles appear here once approved."
      : activeFilter === "published"
        ? "Nothing live yet."
        : "Nothing here yet.";

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {FILTER_ORDER.map((filter) => (
          <Link key={filter} href={filterHref(filter)} className={pillClass(filter)}>
            {FILTER_LABELS[filter]}
          </Link>
        ))}
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
                <th className="px-5 py-3 font-medium">Ready since</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {drafts.map((draft) => {
                const tone = getStatusTone(draft.status);
                const ts = readySinceTimestamp(draft);
                const isOperatorStatus =
                  draft.status === "approved" || draft.status === "published";
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
                    <td className="px-5 py-4 text-xs text-[#3B2F2F]/72" title={ts}>
                      {formatRelativeTime(ts)}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${tone.pill}`}
                      >
                        {isOperatorStatus
                          ? STATUS_PILL_LABEL[
                              draft.status as "approved" | "published"
                            ]
                          : draft.status}
                      </span>
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
