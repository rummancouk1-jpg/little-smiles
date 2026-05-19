// Operational cards for the editorial overview. Five cards arranged on
// a 2-column grid (1-column on mobile). Each card shows a count, the
// top 1-3 titles for context, and a clear next action.
//
// Visual hierarchy:
//   - eyebrow label + count (top row, compact)
//   - up to 3 preview items with optional secondary line
//   - calm "+ N more" tail when the list is truncated
//   - underlined CTA at the bottom
//
// The empty-state copy per card is intentionally reassuring rather than
// blank — "You're caught up" reads as a positive operational state,
// not an empty database.

import Link from "next/link";

import { formatRelativeTime } from "@/components/contentops/relative-time";
import type { Draft } from "@/lib/contentops/drafts-store";
import type { Topic } from "@/lib/contentops/topics-store";

type OverviewCardsProps = {
  pendingDrafts: Draft[];
  approvedDrafts: Draft[];
  scheduledDrafts: Draft[];
  publishedDrafts: Draft[];
  queuedTopics: Topic[];
};

type OverviewItem = {
  primary: string;
  secondary?: string;
};

type CardProps = {
  title: string;
  count: number;
  items: OverviewItem[];
  href: string;
  ctaLabel: string;
  emptyCopy: string;
};

function Card({ title, count, items, href, ctaLabel, emptyCopy }: CardProps) {
  return (
    <article className="flex h-full flex-col rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-5 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-7">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#3B2F2F]/55">
          {title}
        </p>
        <p className="text-2xl font-semibold tabular-nums text-[#1F1918]">{count}</p>
      </div>

      <div className="mt-3 flex-1">
        {items.length === 0 ? (
          <p className="text-sm leading-relaxed text-[#3B2F2F]/65">{emptyCopy}</p>
        ) : (
          <ul className="space-y-1.5">
            {items.slice(0, 3).map((item, idx) => (
              <li key={idx} className="text-sm leading-snug text-[#1F1918]">
                <span className="mr-1 text-[#3B2F2F]/40">•</span>
                <span className="line-clamp-1 inline">{item.primary}</span>
                {item.secondary ? (
                  <span className="ml-1 text-xs text-[#3B2F2F]/55">
                    · {item.secondary}
                  </span>
                ) : null}
              </li>
            ))}
            {count > 3 ? (
              <li className="text-xs text-[#3B2F2F]/55">
                + {count - 3} more
              </li>
            ) : null}
          </ul>
        )}
      </div>

      <Link
        href={href}
        className="mt-5 inline-block text-xs font-medium text-[#1F1918] underline underline-offset-2 hover:text-[#3B2F2F]"
      >
        {ctaLabel} →
      </Link>
    </article>
  );
}

export function OverviewCards(props: OverviewCardsProps) {
  const recentPublished = [...props.publishedDrafts]
    .sort((a, b) => {
      const ta = a.published_at ? new Date(a.published_at).getTime() : 0;
      const tb = b.published_at ? new Date(b.published_at).getTime() : 0;
      return tb - ta;
    })
    .slice(0, 3);

  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Card
        title="Drafts awaiting review"
        count={props.pendingDrafts.length}
        items={props.pendingDrafts.map((d) => ({ primary: d.content.title }))}
        href="/admin/contentops/drafts"
        ctaLabel="Open editorial queue"
        emptyCopy="You're caught up. Nothing waiting for your review."
      />
      <Card
        title="Ready to publish"
        count={props.approvedDrafts.length}
        items={props.approvedDrafts.map((d) => ({ primary: d.content.title }))}
        href="/admin/contentops/publishing"
        ctaLabel="Open publishing queue"
        emptyCopy="No approved drafts waiting to ship."
      />
      <Card
        title="Scheduled"
        count={props.scheduledDrafts.length}
        items={props.scheduledDrafts.map((d) => ({
          primary: d.content.title,
          secondary: d.scheduled_at
            ? new Date(d.scheduled_at).toLocaleDateString("en-PK", {
                month: "short",
                day: "2-digit",
              })
            : undefined,
        }))}
        href="/admin/contentops/publishing?filter=scheduled"
        ctaLabel="View schedule"
        emptyCopy="Nothing scheduled."
      />
      <Card
        title="Topic queue"
        count={props.queuedTopics.length}
        items={props.queuedTopics.map((t) => ({ primary: t.title }))}
        href="/admin/contentops/topics"
        ctaLabel="Open topic queue"
        emptyCopy="No queued topics. Add one to start the next article."
      />
      <Card
        title="Recently live"
        count={recentPublished.length}
        items={recentPublished.map((d) => ({
          primary: d.content.title,
          secondary: d.published_at ? formatRelativeTime(d.published_at) : undefined,
        }))}
        href="/admin/contentops/publishing?filter=published"
        ctaLabel="See all live articles"
        emptyCopy="No articles published yet."
      />
    </section>
  );
}
