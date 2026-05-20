// Single topic card — editorial planning + intelligence layer (Commit V).
//
// Surfaces the topic's editorial intelligence calmly:
//   - Priority eyebrow (color-toned)
//   - Status pill
//   - Title
//   - Content angle (italic editorial framing)
//   - One-line rationale composed from seasonality + intent + competition
//   - Compact meta line: intent · category · seasonality
//   - Optional suggested CTA preview
//   - Optional suggested publish window
//   - Optional confidence score (subtle, only when present)
//   - Optional notes (italic, smaller)
//   - Snoozed-until line when paused
//   - View-draft / view-article link when linked
//   - Actions row (TopicActions)
//
// All fields below the title degrade gracefully: when an intelligence
// field is absent the card simply omits that line, no placeholders.

import Link from "next/link";

import { TopicActions } from "@/components/contentops/topic-actions";
import {
  composeTopicRationale,
  getTopicIntentLabel,
  getTopicPriorityLabel,
  getTopicPriorityTone,
  getTopicSeasonalityLabel,
  getTopicStatusFilterLabel,
  getTopicStatusTone,
} from "@/components/contentops/topic-labels";
import { formatAbsolute, formatRelativeTime } from "@/components/contentops/relative-time";
import type { Topic } from "@/lib/contentops/topics-store";

type TopicCardProps = {
  topic: Topic;
};

function formatDateOnly(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-PK", { month: "short", day: "2-digit" });
}

export function TopicCard({ topic }: TopicCardProps) {
  const tone = getTopicStatusTone(topic.status);
  const priorityClass = getTopicPriorityTone(topic.priority);

  const metaParts: string[] = [getTopicIntentLabel(topic.intent)];
  if (topic.related_category) metaParts.push(topic.related_category);
  metaParts.push(getTopicSeasonalityLabel(topic.seasonality));

  const rationale = composeTopicRationale(topic);

  const windowStart = formatDateOnly(topic.suggested_window_start);
  const windowEnd = formatDateOnly(topic.suggested_window_end);
  const windowLabel =
    windowStart && windowEnd
      ? `${windowStart} – ${windowEnd}`
      : windowStart
        ? `From ${windowStart}`
        : windowEnd
          ? `Through ${windowEnd}`
          : null;

  const snoozedUntilLabel = topic.snoozed_until
    ? formatAbsolute(topic.snoozed_until)
    : null;

  const showDraftLink =
    (topic.status === "drafted" || topic.status === "published") &&
    topic.draft_id;

  return (
    <article className="rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-5 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className={`text-xs font-medium uppercase tracking-[0.18em] ${priorityClass}`}>
          {getTopicPriorityLabel(topic.priority)}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {topic.format ? (
            <span className="rounded-full bg-[#EFE7DE] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-[#3B2F2F]/72">
              {topic.format.replace(/_/g, " ")}
            </span>
          ) : null}
          {topic.cluster ? (
            <span className="rounded-full bg-[#D7E4EE] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-[#1E3F5A]">
              {topic.cluster}
            </span>
          ) : null}
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] ${tone.pill}`}
          >
            {getTopicStatusFilterLabel(topic.status)}
          </span>
        </div>
      </div>

      <h3 className="mt-3 text-lg font-semibold leading-snug text-[#1F1918]">
        {topic.title}
      </h3>

      {topic.content_angle ? (
        <p className="mt-2 text-sm italic leading-relaxed text-[#3B2F2F]/75">
          {topic.content_angle}
        </p>
      ) : null}

      <p className="mt-3 text-xs leading-relaxed text-[#3B2F2F]/72">
        {rationale}
      </p>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#3B2F2F]/65">
        <p>{metaParts.join(" · ")}</p>
        {typeof topic.confidence_score === "number" ? (
          <p className="text-[#3B2F2F]/55">Confidence {topic.confidence_score}</p>
        ) : null}
      </div>

      {topic.suggested_cta ? (
        <p className="mt-2 text-xs text-[#3B2F2F]/65">
          <span className="font-medium text-[#3B2F2F]/75">Suggested CTA:</span>{" "}
          {topic.suggested_cta}
        </p>
      ) : null}

      {windowLabel ? (
        <p className="mt-2 text-xs text-[#3B2F2F]/65">
          <span className="font-medium text-[#3B2F2F]/75">Publish window:</span>{" "}
          {windowLabel}
        </p>
      ) : null}

      {topic.status === "snoozed" && snoozedUntilLabel ? (
        <p className="mt-2 text-xs text-[#3F2F5A]">
          Saved for later · resurfaces {snoozedUntilLabel}
        </p>
      ) : null}

      {topic.notes ? (
        <p className="mt-3 text-xs italic leading-relaxed text-[#3B2F2F]/65">
          {topic.notes}
        </p>
      ) : null}

      {showDraftLink ? (
        <div className="mt-3">
          <Link
            href={`/admin/contentops/${topic.draft_id}`}
            className="text-xs font-medium text-[#1E3F5A] underline underline-offset-2 hover:text-[#163049]"
          >
            {topic.status === "published" ? "View article →" : "View draft →"}
          </Link>
        </div>
      ) : null}

      <p className="mt-3 text-[11px] text-[#3B2F2F]/55" title={topic.created_at}>
        Added {formatRelativeTime(topic.created_at)}
        {topic.source === "seed" ? " · curated starter" : ""}
      </p>

      <div className="mt-5">
        <TopicActions
          topicId={topic.id}
          status={topic.status}
          priority={topic.priority}
        />
      </div>
    </article>
  );
}
