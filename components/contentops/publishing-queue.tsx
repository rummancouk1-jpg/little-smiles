// Engine component — operator-facing queue. Lists drafts that are
// approved (ready to publish), scheduled (publish queued for a future
// time), or already published (historical). The reviewer never lands
// here; her surface remains at /admin/contentops.
//
// Commit M adds the scheduled filter and surfaces the scheduled_at
// timestamp in the "When" column for scheduled rows.

import Link from "next/link";

import { type Draft, type DraftStatus } from "@/lib/contentops/drafts-store";
import { getStatusTone } from "@/components/contentops/labels";
import { formatAbsolute, formatRelativeTime } from "@/components/contentops/relative-time";

export type OperatorFilter = "approved" | "scheduled" | "published" | "all";

type PublishingQueueProps = {
  drafts: Draft[];
  activeFilter: OperatorFilter;
  baseHref: string;
  detailHref: (id: string) => string;
};

const FILTER_LABELS: Record<OperatorFilter, string> = {
  approved: "Ready",
  scheduled: "Scheduled",
  published: "Live",
  all: "All",
};

const FILTER_ORDER: OperatorFilter[] = ["approved", "scheduled", "published", "all"];

const STATUS_PILL_LABEL: Record<
  Extract<DraftStatus, "approved" | "scheduled" | "published">,
  string
> = {
  approved: "Ready",
  scheduled: "Scheduled",
  published: "Live",
};

function isOperatorStatus(
  status: DraftStatus,
): status is "approved" | "scheduled" | "published" {
  return status === "approved" || status === "scheduled" || status === "published";
}

type WhenCell = { value: string; absolute: boolean };

function whenCellFor(draft: Draft): WhenCell {
  if (draft.status === "scheduled" && draft.scheduled_at) {
    return { value: formatAbsolute(draft.scheduled_at), absolute: true };
  }
  if (draft.status === "published" && draft.published_at) {
    return { value: formatRelativeTime(draft.published_at), absolute: false };
  }
  if (draft.status === "approved" && draft.approved_at) {
    return { value: formatRelativeTime(draft.approved_at), absolute: false };
  }
  return { value: formatRelativeTime(draft.created_at), absolute: false };
}

function rawTimestampFor(draft: Draft): string {
  if (draft.status === "scheduled") return draft.scheduled_at ?? draft.created_at;
  if (draft.status === "published") return draft.published_at ?? draft.created_at;
  if (draft.status === "approved") return draft.approved_at ?? draft.created_at;
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

  const filterHref = (filter: OperatorFilter) =>
    filter === "approved" ? baseHref : `${baseHref}?filter=${filter}`;

  const emptyLabel =
    activeFilter === "approved"
      ? "All caught up. Articles appear here once approved."
      : activeFilter === "scheduled"
        ? "Nothing scheduled."
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
                <th className="px-5 py-3 font-medium">When</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {drafts.map((draft) => {
                const tone = getStatusTone(draft.status);
                const when = whenCellFor(draft);
                const rawTs = rawTimestampFor(draft);
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
                    <td className="px-5 py-4 text-xs text-[#3B2F2F]/72" title={rawTs}>
                      {when.absolute ? (
                        <span>
                          <span className="text-[10px] uppercase tracking-[0.12em] text-[#3B2F2F]/55">
                            for
                          </span>{" "}
                          {when.value}
                        </span>
                      ) : (
                        when.value
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${tone.pill}`}
                      >
                        {isOperatorStatus(draft.status)
                          ? STATUS_PILL_LABEL[draft.status]
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
