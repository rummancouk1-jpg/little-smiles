// Forward-looking cadence view. Three vertical buckets — This week,
// Next week, Later — listing scheduled drafts in chronological order.
// Empty buckets show calm muted copy rather than "0" so the operator
// reads the publishing rhythm as a whole rather than as a count.
//
// Each entry is a small editorial row: absolute date + relative hint
// ("Wed May 21 · in 2d"), then the article title as a navigation link
// to the publish surface for that draft.

import Link from "next/link";

import {
  formatAbsolute,
  formatRelativeFuture,
} from "@/components/contentops/relative-time";
import type { Draft } from "@/lib/contentops/drafts-store";

type PublishingCadenceProps = {
  scheduledDrafts: Draft[];
};

const DAY_MS = 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * DAY_MS;
const FOURTEEN_DAYS_MS = 14 * DAY_MS;

type CadenceBuckets = {
  thisWeek: Draft[];
  nextWeek: Draft[];
  later: Draft[];
};

function bucketize(drafts: Draft[]): CadenceBuckets {
  const now = Date.now();
  const buckets: CadenceBuckets = {
    thisWeek: [],
    nextWeek: [],
    later: [],
  };
  for (const draft of drafts) {
    if (!draft.scheduled_at) continue;
    const ts = new Date(draft.scheduled_at).getTime();
    if (Number.isNaN(ts) || ts <= now) continue;
    const delta = ts - now;
    if (delta < SEVEN_DAYS_MS) buckets.thisWeek.push(draft);
    else if (delta < FOURTEEN_DAYS_MS) buckets.nextWeek.push(draft);
    else buckets.later.push(draft);
  }
  const sortAscending = (a: Draft, b: Draft) => {
    const ta = a.scheduled_at ? new Date(a.scheduled_at).getTime() : 0;
    const tb = b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0;
    return ta - tb;
  };
  buckets.thisWeek.sort(sortAscending);
  buckets.nextWeek.sort(sortAscending);
  buckets.later.sort(sortAscending);
  return buckets;
}

function CadenceBucket({
  label,
  drafts,
  emptyCopy,
}: {
  label: string;
  drafts: Draft[];
  emptyCopy: string;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#3B2F2F]/55">
        {label}
      </p>
      {drafts.length === 0 ? (
        <p className="mt-2 text-sm text-[#3B2F2F]/55">{emptyCopy}</p>
      ) : (
        <ul className="mt-3 space-y-4">
          {drafts.map((d) => (
            <li
              key={d.id}
              className="border-l-2 border-[#2F4F6A]/25 pl-3"
            >
              <p className="text-xs text-[#3B2F2F]/65">
                {d.scheduled_at ? formatAbsolute(d.scheduled_at) : "—"}
                {d.scheduled_at ? (
                  <span className="ml-2 text-[#1E3F5A]/85">
                    · {formatRelativeFuture(d.scheduled_at)}
                  </span>
                ) : null}
              </p>
              <Link
                href={`/admin/contentops/publishing/${d.id}`}
                className="mt-1 block text-sm font-medium leading-snug text-[#1F1918] underline-offset-2 hover:underline"
              >
                {d.content.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PublishingCadence({ scheduledDrafts }: PublishingCadenceProps) {
  const buckets = bucketize(scheduledDrafts);

  return (
    <section className="rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-7 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-9">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#3B2F2F]/55">
            Publishing cadence
          </p>
          <p className="mt-1 text-sm text-[#3B2F2F]/72">
            What&rsquo;s queued to go live, sorted by when.
          </p>
        </div>
        <p className="text-xs text-[#3B2F2F]/55">Next 14 days</p>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-3">
        <CadenceBucket
          label="This week"
          drafts={buckets.thisWeek}
          emptyCopy="Nothing publishing this week."
        />
        <CadenceBucket
          label="Next week"
          drafts={buckets.nextWeek}
          emptyCopy="Nothing scheduled for next week."
        />
        <CadenceBucket
          label="Later"
          drafts={buckets.later}
          emptyCopy="No further posts scheduled."
        />
      </div>
    </section>
  );
}
