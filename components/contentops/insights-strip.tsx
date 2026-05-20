// Editorial pulse strip. Derives a small, calm list of operational hints
// from the current system state — what's actionable, what's running low,
// what's missing. Renders nothing when the system is fully balanced so
// the overview stays uncluttered.
//
// Tone is helpful, not alarming. No urgency icons, no red badges. Each
// line is one plain English sentence the operator can scan in seconds.

import type { Draft } from "@/lib/contentops/drafts-store";
import type { Topic } from "@/lib/contentops/topics-store";

type InsightsStripProps = {
  pendingDrafts: Draft[];
  approvedDrafts: Draft[];
  scheduledDrafts: Draft[];
  queuedTopics: Topic[];
};

type InsightTone = "actionable" | "low" | "neutral";

type Insight = {
  message: string;
  tone: InsightTone;
};

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const LOW_TOPIC_THRESHOLD = 5;

function pluralize(n: number, singular: string, plural: string): string {
  return n === 1 ? singular : plural;
}

function deriveInsights(props: InsightsStripProps): Insight[] {
  const insights: Insight[] = [];
  const now = Date.now();

  // 1. Pending review is the reviewer's actionable bucket.
  if (props.pendingDrafts.length > 0) {
    insights.push({
      message: `${props.pendingDrafts.length} ${pluralize(props.pendingDrafts.length, "draft is", "drafts are")} awaiting review.`,
      tone: "actionable",
    });
  }

  // 2. Approved drafts ready to publish or schedule.
  if (props.approvedDrafts.length > 0) {
    insights.push({
      message: `${props.approvedDrafts.length} approved ${pluralize(props.approvedDrafts.length, "draft is", "drafts are")} ready to publish.`,
      tone: "actionable",
    });
  }

  // 3. Scheduling cadence visibility.
  const upcomingScheduled = props.scheduledDrafts.filter((d) => {
    if (!d.scheduled_at) return false;
    const ts = new Date(d.scheduled_at).getTime();
    return ts > now && ts < now + SEVEN_DAYS_MS;
  });
  if (upcomingScheduled.length === 0) {
    if (props.scheduledDrafts.length === 0) {
      insights.push({
        message: "No posts are scheduled.",
        tone: "low",
      });
    } else {
      insights.push({
        message: "Nothing is scheduled to publish in the next 7 days.",
        tone: "low",
      });
    }
  }

  // 4. Topic queue depth — keep ideas flowing.
  if (props.queuedTopics.length < LOW_TOPIC_THRESHOLD) {
    insights.push({
      message: `Topic queue running low — only ${props.queuedTopics.length} queued ${pluralize(props.queuedTopics.length, "idea", "ideas")}.`,
      tone: "low",
    });
  }

  // 5. Missing hero imagery on drafts that are otherwise ready.
  const missingHero = [
    ...props.approvedDrafts,
    ...props.scheduledDrafts,
  ].filter((d) => !d.content.hero);
  if (missingHero.length > 0) {
    insights.push({
      message: `${missingHero.length} ${pluralize(missingHero.length, "draft is", "drafts are")} missing a hero image.`,
      tone: "neutral",
    });
  }

  return insights;
}

const TONE_CLASSES: Record<InsightTone, string> = {
  actionable: "border-[#2E6A41]/20 bg-[#EAF5EE] text-[#1E5A37]",
  low: "border-[#8A6A2F]/20 bg-[#FBF5EA] text-[#5E4A1C]",
  neutral: "border-[#3B2F2F]/12 bg-[#FBF7F3] text-[#3B2F2F]",
};

export function InsightsStrip(props: InsightsStripProps) {
  const insights = deriveInsights(props);
  if (insights.length === 0) return null;

  return (
    <section className="rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-5 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-7">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#3B2F2F]/55">
        Editorial pulse
      </p>
      <ul className="mt-3 space-y-2">
        {insights.map((insight, idx) => (
          <li
            key={idx}
            className={`rounded-2xl border px-4 py-2.5 text-sm leading-relaxed ${TONE_CLASSES[insight.tone]}`}
          >
            {insight.message}
          </li>
        ))}
      </ul>
    </section>
  );
}
