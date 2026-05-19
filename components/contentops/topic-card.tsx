// Single topic card — editorial planning surface. Card layout (not a
// table row) so the operator's eye reads each topic as a thought, not a
// data point. Priority is rendered as eyebrow text colored by level;
// intent + category + seasonality sit on a single secondary line; notes
// (if present) read as small italic editorial commentary.
//
// Actions live in the TopicActions client component below the metadata
// so the card's content stays calm by default and the verbs cluster
// together.

import Link from "next/link";

import { TopicActions } from "@/components/contentops/topic-actions";
import {
  getTopicIntentLabel,
  getTopicPriorityLabel,
  getTopicPriorityTone,
  getTopicSeasonalityLabel,
  getTopicStatusFilterLabel,
  getTopicStatusTone,
} from "@/components/contentops/topic-labels";
import { formatRelativeTime } from "@/components/contentops/relative-time";
import type { Topic } from "@/lib/contentops/topics-store";

type TopicCardProps = {
  topic: Topic;
};

export function TopicCard({ topic }: TopicCardProps) {
  const tone = getTopicStatusTone(topic.status);
  const priorityClass = getTopicPriorityTone(topic.priority);

  const metaParts: string[] = [getTopicIntentLabel(topic.intent)];
  if (topic.related_category) metaParts.push(topic.related_category);
  metaParts.push(getTopicSeasonalityLabel(topic.seasonality));

  return (
    <article className="rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-5 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className={`text-xs font-medium uppercase tracking-[0.18em] ${priorityClass}`}>
          {getTopicPriorityLabel(topic.priority)}
        </p>
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] ${tone.pill}`}
        >
          {getTopicStatusFilterLabel(topic.status)}
        </span>
      </div>

      <h3 className="mt-3 text-lg font-semibold leading-snug text-[#1F1918]">
        {topic.title}
      </h3>

      <p className="mt-2 text-xs text-[#3B2F2F]/65">
        {metaParts.join(" · ")}
      </p>

      {topic.notes ? (
        <p className="mt-3 text-sm italic leading-relaxed text-[#3B2F2F]/72">
          {topic.notes}
        </p>
      ) : null}

      {topic.status === "drafted" && topic.draft_id ? (
        <div className="mt-3">
          <Link
            href={`/admin/contentops/${topic.draft_id}`}
            className="text-xs font-medium text-[#1E3F5A] underline underline-offset-2 hover:text-[#163049]"
          >
            View draft →
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
