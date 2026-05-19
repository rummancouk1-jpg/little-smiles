// Editorial replacement for the old engineering status banner. Tells the
// operator three things at a glance: where this article will live, what
// state it's in, and when (if scheduled) it goes public.
//
// Replaces the "Cleared for publish" / "Needs attention" banner that
// previously sat at the top of PublishReport. The status pill stays —
// it's the calm one-line signal — but the rest of this card is
// editorial: URL, category, scheduled time, last-checked timestamp.

import { formatAbsolute, formatRelativeFuture } from "@/components/contentops/relative-time";
import type { Draft } from "@/lib/contentops/drafts-store";
import { siteUrl } from "@/lib/site";

type PublishingDestinationProps = {
  draft: Draft;
  preparedAt: string;
  ready: boolean;
};

type PillTone = "ready" | "scheduled" | "needs_attention";

function pillFor(draft: Draft, ready: boolean): { tone: PillTone; label: string } {
  if (draft.status === "scheduled") return { tone: "scheduled", label: "Scheduled" };
  if (!ready) return { tone: "needs_attention", label: "Needs attention" };
  return { tone: "ready", label: "Cleared for publish" };
}

const TONE_STYLES: Record<PillTone, { container: string; pill: string; label: string }> = {
  ready: {
    container: "border-[#2E6A41]/25 bg-[#EAF5EE]",
    pill: "bg-[#D7ECDD] text-[#1E5A37]",
    label: "text-[#1E5A37]",
  },
  scheduled: {
    container: "border-[#2F4F6A]/25 bg-[#EAF1F7]",
    pill: "bg-[#D7E4EE] text-[#1E3F5A]",
    label: "text-[#1E3F5A]",
  },
  needs_attention: {
    container: "border-[#8A2F40]/25 bg-[#FBEEF1]",
    pill: "bg-[#FBEEF1] text-[#5E1C29] border border-[#8A2F40]/20",
    label: "text-[#5E1C29]",
  },
};

function displayHost(url: string): string {
  // Strip protocol so the displayed URL reads as editorial copy
  // (operator already knows the brand domain) rather than a raw href.
  return url.replace(/^https?:\/\//, "");
}

export function PublishingDestination({
  draft,
  preparedAt,
  ready,
}: PublishingDestinationProps) {
  const pill = pillFor(draft, ready);
  const tone = TONE_STYLES[pill.tone];
  const host = displayHost(siteUrl);
  const destination = `${host}/blog/${draft.content.slug}`;

  const scheduledLine =
    draft.status === "scheduled" && draft.scheduled_at
      ? {
          absolute: formatAbsolute(draft.scheduled_at),
          relative: formatRelativeFuture(draft.scheduled_at),
        }
      : null;

  return (
    <section
      className={`rounded-3xl border p-7 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-9 ${tone.container}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className={`text-xs font-medium uppercase tracking-[0.18em] ${tone.label}`}>
          Publishing destination
        </p>
        <span
          className={`rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] ${tone.pill}`}
        >
          {pill.label}
        </span>
      </div>

      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[#1F1918] sm:text-3xl">
        {draft.content.title}
      </h2>

      <dl className="mt-6 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium uppercase tracking-[0.12em] text-[#3B2F2F]/55">
            Will live at
          </dt>
          <dd className="mt-1 font-mono text-[#1F1918]">{destination}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-[0.12em] text-[#3B2F2F]/55">
            Category
          </dt>
          <dd className="mt-1 text-[#1F1918]">{draft.content.category}</dd>
        </div>
        {scheduledLine ? (
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium uppercase tracking-[0.12em] text-[#3B2F2F]/55">
              Goes live
            </dt>
            <dd className={`mt-1 ${tone.label}`}>
              {scheduledLine.absolute}
              <span className="ml-2 text-[#3B2F2F]/65">· {scheduledLine.relative}</span>
            </dd>
          </div>
        ) : null}
      </dl>

      <p className="mt-6 text-xs text-[#3B2F2F]/55">
        Last checked {formatAbsolute(preparedAt)}
      </p>
    </section>
  );
}
