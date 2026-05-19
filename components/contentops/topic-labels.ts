// Display labels and palette tones for ContentOps topics. Engine values
// (TopicStatus, TopicPriority, TopicSeasonality, TopicIntent) stay as
// today; this file maps them to the operator-facing copy and Tailwind
// classes used across the topics surface.

import type {
  Topic,
  TopicIntent,
  TopicPriority,
  TopicSeasonality,
  TopicStatus,
} from "@/lib/contentops/topics-store";

export const TOPIC_STATUS_LABELS: Record<TopicStatus, string> = {
  queued: "In queue",
  snoozed: "Saved for later",
  drafted: "Drafted",
  published: "Live on site",
  archived: "Archived",
};

export const TOPIC_STATUS_FILTER_LABELS: Record<TopicStatus, string> = {
  queued: "Queued",
  snoozed: "Saved for later",
  drafted: "Drafted",
  published: "Live",
  archived: "Archived",
};

type StatusTone = {
  pill: string;
};

export const TOPIC_STATUS_TONES: Record<TopicStatus, StatusTone> = {
  queued: { pill: "bg-[#EFE7DE] text-[#3B2F2F]" },
  snoozed: { pill: "bg-[#EAE3F1] text-[#3F2F5A]" },
  drafted: { pill: "bg-[#D7E4EE] text-[#1E3F5A]" },
  published: { pill: "bg-[#C5DECD] text-[#175030]" },
  archived: { pill: "bg-[#E5DAD2] text-[#5B342B]" },
};

export const TOPIC_PRIORITY_LABELS: Record<TopicPriority, string> = {
  high: "High priority",
  medium: "Medium priority",
  low: "Low priority",
};

// Priority is rendered as eyebrow text, not a heavy pill. Color tones
// stay restrained — Little Smiles is editorial, not analytics.
export const TOPIC_PRIORITY_TONES: Record<TopicPriority, string> = {
  high: "text-[#5E1C29]",
  medium: "text-[#3B2F2F]/70",
  low: "text-[#3B2F2F]/45",
};

export const TOPIC_INTENT_LABELS: Record<TopicIntent, string> = {
  informational: "Informational",
  commercial: "Commercial",
  transactional: "Transactional",
};

export const TOPIC_SEASONALITY_LABELS: Record<TopicSeasonality, string> = {
  evergreen: "Year-round",
  summer: "Summer",
  winter: "Winter",
  monsoon: "Monsoon",
  eid: "Eid season",
};

export function getTopicStatusLabel(status: TopicStatus): string {
  return TOPIC_STATUS_LABELS[status];
}

export function getTopicStatusFilterLabel(status: TopicStatus): string {
  return TOPIC_STATUS_FILTER_LABELS[status];
}

export function getTopicStatusTone(status: TopicStatus): StatusTone {
  return TOPIC_STATUS_TONES[status];
}

export function getTopicPriorityLabel(priority: TopicPriority): string {
  return TOPIC_PRIORITY_LABELS[priority];
}

export function getTopicPriorityTone(priority: TopicPriority): string {
  return TOPIC_PRIORITY_TONES[priority];
}

export function getTopicIntentLabel(intent: TopicIntent): string {
  return TOPIC_INTENT_LABELS[intent];
}

export function getTopicSeasonalityLabel(seasonality: TopicSeasonality): string {
  return TOPIC_SEASONALITY_LABELS[seasonality];
}

// Pure heuristic that composes a calm one-line rationale from the topic's
// existing fields. No SEO jargon, no scoring math — just the editorial
// reasons the operator should know in plain English.
//
// Example outputs:
//   "Strong summer relevance · commercial intent · anchors to Swaddle"
//   "Year-round informational depth · low competition"
//
// Future intelligence layers can replace this with a learned rationale,
// but the operator-facing copy stays in this single function.
export function composeTopicRationale(topic: Topic): string {
  const parts: string[] = [];

  switch (topic.seasonality) {
    case "summer":
      parts.push("Strong summer relevance");
      break;
    case "winter":
      parts.push("Winter timing");
      break;
    case "monsoon":
      parts.push("Monsoon-season demand");
      break;
    case "eid":
      parts.push("Eid gifting window");
      break;
    case "evergreen":
    default:
      parts.push("Year-round relevance");
      break;
  }

  switch (topic.intent) {
    case "commercial":
      parts.push("commercial intent");
      break;
    case "transactional":
      parts.push("purchase intent");
      break;
    case "informational":
    default:
      parts.push("informational depth");
      break;
  }

  if (topic.competition === "low") parts.push("low competition");
  else if (topic.competition === "high") parts.push("competitive space");

  if (topic.related_category) {
    parts.push(`anchors to ${topic.related_category}`);
  }

  return parts.join(" · ");
}
