// Engine layer for the contentops_topics table. Pure typed read/write
// helpers — no auth, no UI, no project-specific knowledge. Mirrors the
// drafts-store pattern so the editorial layer and the drafting layer
// have parallel shapes.
//
// State machine:
//   queued    -> drafted   (linkTopicToDraft after generation)
//   drafted   -> published (notifyDraftPublished after publish API/cron)
//   queued    -> archived  (archiveTopic — explicit operator action)
//   drafted   -> archived  (archiveTopic — operator can give up on a draft)
//   archived  -> X         (terminal in Commit R; re-activation deferred)

import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export type TopicStatus = "queued" | "drafted" | "published" | "archived";
export type TopicPriority = "high" | "medium" | "low";
export type TopicIntent = "informational" | "commercial" | "transactional";
export type TopicCompetition = "low" | "medium" | "high";
export type TopicSeasonality = "evergreen" | "summer" | "winter" | "monsoon" | "eid";
export type TopicTrend = "rising" | "steady" | "declining";
export type TopicSource = "manual" | "seed";

export type Topic = {
  id: string;
  title: string;
  intent: TopicIntent;
  related_category: string | null;
  priority: TopicPriority;
  competition: TopicCompetition;
  seasonality: TopicSeasonality;
  trend: TopicTrend;
  suggested_window_start: string | null;
  suggested_window_end: string | null;
  status: TopicStatus;
  draft_id: string | null;
  source: TopicSource;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export const TOPIC_STATUSES: TopicStatus[] = [
  "queued",
  "drafted",
  "published",
  "archived",
];

export const TOPIC_PRIORITIES: TopicPriority[] = ["high", "medium", "low"];
export const TOPIC_INTENTS: TopicIntent[] = [
  "informational",
  "commercial",
  "transactional",
];
export const TOPIC_SEASONALITIES: TopicSeasonality[] = [
  "evergreen",
  "summer",
  "winter",
  "monsoon",
  "eid",
];

export function isTopicStatus(value: string): value is TopicStatus {
  return (TOPIC_STATUSES as string[]).includes(value);
}

export function isTopicPriority(value: string): value is TopicPriority {
  return (TOPIC_PRIORITIES as string[]).includes(value);
}

export function isTopicIntent(value: string): value is TopicIntent {
  return (TOPIC_INTENTS as string[]).includes(value);
}

export function isTopicSeasonality(value: string): value is TopicSeasonality {
  return (TOPIC_SEASONALITIES as string[]).includes(value);
}

// Priority sort order — queued topics are displayed high first, then
// medium, then low, then created_at desc within each band.
const PRIORITY_RANK: Record<TopicPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function requireClient() {
  const client = getSupabaseAdminClient();
  if (!client) {
    throw new Error("Supabase admin client is not configured.");
  }
  return client;
}

function sortByPriorityThenCreated(topics: Topic[]): Topic[] {
  return [...topics].sort((a, b) => {
    const pa = PRIORITY_RANK[a.priority];
    const pb = PRIORITY_RANK[b.priority];
    if (pa !== pb) return pa - pb;
    // newest first within the same priority band
    return b.created_at.localeCompare(a.created_at);
  });
}

export async function listTopics(status?: TopicStatus): Promise<Topic[]> {
  const supabase = requireClient();
  let query = supabase
    .from("contentops_topics")
    .select("*")
    .limit(500);
  if (status) {
    query = query.eq("status", status);
  }
  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to list topics: ${error.message}`);
  }
  return sortByPriorityThenCreated((data ?? []) as Topic[]);
}

export async function getTopicById(id: string): Promise<Topic | null> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from("contentops_topics")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to fetch topic: ${error.message}`);
  }
  return (data as Topic | null) ?? null;
}

type CreateTopicInput = {
  title: string;
  intent: TopicIntent;
  related_category?: string | null;
  priority?: TopicPriority;
  seasonality?: TopicSeasonality;
  notes?: string | null;
};

export async function createTopic(input: CreateTopicInput): Promise<Topic> {
  const supabase = requireClient();
  const title = input.title.trim();
  if (title.length < 5 || title.length > 200) {
    throw new Error("Topic title must be 5-200 characters.");
  }

  const { data, error } = await supabase
    .from("contentops_topics")
    .insert({
      title,
      intent: input.intent,
      related_category: input.related_category ?? null,
      priority: input.priority ?? "medium",
      competition: "medium",
      seasonality: input.seasonality ?? "evergreen",
      trend: "steady",
      suggested_window_start: null,
      suggested_window_end: null,
      status: "queued",
      draft_id: null,
      source: "manual",
      notes: input.notes?.trim() ? input.notes.trim().slice(0, 2000) : null,
    })
    .select("*")
    .single();
  if (error || !data) {
    // Surface unique-constraint collisions in a way the operator can act on.
    if (error?.code === "23505") {
      throw new Error(
        `A topic titled "${title}" already exists. Use the existing one or pick a different title.`,
      );
    }
    throw new Error(`Failed to create topic: ${error?.message ?? "no row returned"}`);
  }
  return data as Topic;
}

export async function archiveTopic(id: string): Promise<Topic> {
  const supabase = requireClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("contentops_topics")
    .update({ status: "archived", updated_at: now })
    .eq("id", id)
    .in("status", ["queued", "drafted", "published"])
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `Failed to archive topic: ${error?.message ?? "topic not found or already archived"}`,
    );
  }
  return data as Topic;
}

export async function updateTopicPriority(
  id: string,
  priority: TopicPriority,
): Promise<Topic> {
  const supabase = requireClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("contentops_topics")
    .update({ priority, updated_at: now })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `Failed to update topic priority: ${error?.message ?? "topic not found"}`,
    );
  }
  return data as Topic;
}

// Marks a queued topic as drafted and links it to the freshly-generated
// draft. SQL-level guard so an already-drafted topic can't double-link.
export async function linkTopicToDraft(
  topicId: string,
  draftId: string,
): Promise<Topic> {
  const supabase = requireClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("contentops_topics")
    .update({
      status: "drafted",
      draft_id: draftId,
      updated_at: now,
    })
    .eq("id", topicId)
    .eq("status", "queued")
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `Failed to link topic to draft: ${error?.message ?? "topic not in queued state"}`,
    );
  }
  return data as Topic;
}

// Best-effort sync: when a draft is published, find any topic linked to
// it and promote its status. No-op when no topic references the draft.
// Throws only on hard DB errors so the caller can decide whether to
// surface or swallow (publish API + cron currently swallow).
export async function notifyDraftPublished(draftId: string): Promise<Topic | null> {
  const supabase = requireClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("contentops_topics")
    .update({ status: "published", updated_at: now })
    .eq("draft_id", draftId)
    .in("status", ["drafted"])
    .select("*")
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to sync topic status: ${error.message}`);
  }
  return (data as Topic | null) ?? null;
}
