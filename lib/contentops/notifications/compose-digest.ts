// Pure composition: takes today's editorial state, returns a calm
// Digest payload. No I/O, no rendering — channels render this shape
// however they need (HTML email today, WhatsApp text later).
//
// Section ordering reflects the operator's mental priority:
//   1. Awaiting your review (most actionable)
//   2. Ready to publish
//   3. Scheduled this week
//   4. Recently live (reassurance)
//   5. Heads up (gentle hints — low queue, missing media, cadence gaps)
//
// Empty sections are omitted. itemCount counts actionable items only
// (not "recently live", which is informational), so the cron can use it
// to decide whether to skip on empty-state preference.

import type { Draft } from "@/lib/contentops/drafts-store";
import type { Topic } from "@/lib/contentops/topics-store";
import type {
  Digest,
  DigestItem,
  DigestSection,
} from "@/lib/contentops/notifications/types";

const DAY_MS = 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * DAY_MS;
const LOW_TOPIC_THRESHOLD = 5;

export type DigestComposeArgs = {
  pendingDrafts: Draft[];
  approvedDrafts: Draft[];
  scheduledDrafts: Draft[];
  publishedDrafts: Draft[];
  queuedTopics: Topic[];
};

function pluralize(n: number, singular: string, plural: string): string {
  return n === 1 ? singular : plural;
}

function asItem(draft: Draft, secondary?: string): DigestItem {
  return {
    primary: draft.content.title,
    secondary,
  };
}

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-PK", {
    weekday: "short",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function relativeFuture(value: string): string {
  const ts = new Date(value).getTime();
  if (Number.isNaN(ts)) return value;
  const delta = ts - Date.now();
  if (delta <= 0) return "now";
  const hours = Math.floor(delta / (60 * 60 * 1000));
  if (hours < 24) return `in ${hours}h`;
  const days = Math.floor(hours / 24);
  return `in ${days}d`;
}

function relativePast(value: string): string {
  const ts = new Date(value).getTime();
  if (Number.isNaN(ts)) return value;
  const delta = Date.now() - ts;
  const hours = Math.floor(delta / (60 * 60 * 1000));
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function composeDailyDigest(args: DigestComposeArgs): Digest {
  const now = Date.now();
  const sections: DigestSection[] = [];
  let actionableItems = 0;

  // 1. Awaiting your review
  if (args.pendingDrafts.length > 0) {
    actionableItems += args.pendingDrafts.length;
    sections.push({
      id: "awaiting_review",
      heading: `${args.pendingDrafts.length} ${pluralize(args.pendingDrafts.length, "article", "articles")} awaiting your review`,
      items: args.pendingDrafts.slice(0, 5).map((d) => asItem(d)),
    });
  }

  // 2. Ready to publish
  if (args.approvedDrafts.length > 0) {
    actionableItems += args.approvedDrafts.length;
    sections.push({
      id: "ready_to_publish",
      heading: `${args.approvedDrafts.length} approved ${pluralize(args.approvedDrafts.length, "draft", "drafts")} ready to publish`,
      items: args.approvedDrafts.slice(0, 5).map((d) => asItem(d)),
    });
  }

  // 3. Scheduled this week (next 7 days)
  const scheduledThisWeek = args.scheduledDrafts
    .filter((d) => {
      if (!d.scheduled_at) return false;
      const ts = new Date(d.scheduled_at).getTime();
      return ts > now && ts <= now + SEVEN_DAYS_MS;
    })
    .sort((a, b) => {
      const ta = a.scheduled_at ? new Date(a.scheduled_at).getTime() : 0;
      const tb = b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0;
      return ta - tb;
    });
  if (scheduledThisWeek.length > 0) {
    actionableItems += scheduledThisWeek.length;
    sections.push({
      id: "scheduled_this_week",
      heading: `Scheduled this week`,
      items: scheduledThisWeek.map((d) =>
        asItem(
          d,
          d.scheduled_at
            ? `${formatDate(d.scheduled_at)} · ${relativeFuture(d.scheduled_at)}`
            : undefined,
        ),
      ),
    });
  }

  // 4. Recently live (last 7 days, informational not actionable)
  const recentlyLive = args.publishedDrafts
    .filter((d) => {
      if (!d.published_at) return false;
      return now - new Date(d.published_at).getTime() <= SEVEN_DAYS_MS;
    })
    .sort((a, b) => {
      const ta = a.published_at ? new Date(a.published_at).getTime() : 0;
      const tb = b.published_at ? new Date(b.published_at).getTime() : 0;
      return tb - ta;
    });
  if (recentlyLive.length > 0) {
    sections.push({
      id: "recently_live",
      heading: `Recently live`,
      items: recentlyLive.slice(0, 5).map((d) =>
        asItem(
          d,
          d.published_at ? relativePast(d.published_at) : undefined,
        ),
      ),
    });
  }

  // 5. Heads up — calm hints
  const headsUpItems: DigestItem[] = [];

  if (args.queuedTopics.length < LOW_TOPIC_THRESHOLD) {
    headsUpItems.push({
      primary: `Topic queue is running low — ${args.queuedTopics.length} queued ${pluralize(args.queuedTopics.length, "idea", "ideas")}.`,
    });
  }

  const missingHero = [
    ...args.approvedDrafts,
    ...args.scheduledDrafts,
  ].filter((d) => !d.content.hero);
  if (missingHero.length > 0) {
    headsUpItems.push({
      primary: `${missingHero.length} ${pluralize(missingHero.length, "draft is", "drafts are")} missing a hero image.`,
    });
  }

  if (scheduledThisWeek.length === 0 && args.scheduledDrafts.length === 0) {
    headsUpItems.push({
      primary: "No posts are scheduled. Add one to keep publishing cadence steady.",
    });
  } else if (scheduledThisWeek.length === 0) {
    headsUpItems.push({
      primary: "Nothing scheduled for the next 7 days.",
    });
  }

  if (headsUpItems.length > 0) {
    actionableItems += headsUpItems.length;
    sections.push({
      id: "heads_up",
      heading: "Heads up",
      items: headsUpItems,
    });
  }

  const emptyState = actionableItems === 0 && recentlyLive.length === 0;

  const greeting = "Good morning.";
  const intro = emptyState
    ? "Nothing pressing today. Enjoy the calm."
    : "Here's where your editorial loop stands.";
  const closing = emptyState
    ? "That's everything."
    : "That's the editorial brief for today.";

  return {
    kind: "daily_digest",
    generatedAt: new Date().toISOString(),
    greeting,
    intro,
    sections,
    closing,
    emptyState,
    itemCount: actionableItems,
  };
}
