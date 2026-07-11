import Link from "next/link";
import type { ReactNode } from "react";

import { toneBadge, toneDot, toneText, type CockpitTone } from "@/components/admin/cockpit-tone";
import { cn } from "@/lib/utils";

/**
 * Compact "at a glance" top zone for any cockpit page — the antidote to endless
 * stacked cards. One headline metric, a few stat mini-cards, and a "Needs your
 * attention" list where each item carries a one-tap action. Presentation only.
 */
export type GlanceStat = {
  label: string;
  value: ReactNode;
  sublabel?: string;
  tone?: CockpitTone;
};

export type GlanceAttentionItem = {
  label: string;
  detail?: string;
  href?: string;
  actionLabel?: string;
  tone?: CockpitTone;
};

type GlanceSummaryProps = {
  eyebrow?: string;
  title: string;
  headline: {
    label: string;
    value: ReactNode;
    sublabel?: string;
    grade?: string;
    tone?: CockpitTone;
  };
  stats?: GlanceStat[];
  attention?: GlanceAttentionItem[];
  attentionTitle?: string;
};

export function GlanceSummary({
  eyebrow,
  title,
  headline,
  stats = [],
  attention = [],
  attentionTitle = "Needs your attention",
}: GlanceSummaryProps) {
  const headlineTone = headline.tone ?? "brass";

  return (
    <section className="rounded-3xl border border-ink-base/12 bg-surface-card/90 p-5 shadow-[0_30px_60px_-40px_rgba(0,0,0,0.7)] sm:p-6">
      {eyebrow ? (
        <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-ink-muted">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="mt-1 font-heading text-3xl text-ink-strong sm:text-4xl">{title}</h1>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,320px)_1fr] lg:gap-6">
        {/* Headline metric */}
        <div className="flex flex-col justify-center rounded-2xl border border-ink-base/12 bg-surface-panel/70 p-5">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-ink-muted">
            {headline.label}
          </p>
          <div className="mt-2 flex flex-wrap items-baseline gap-3">
            <span className={cn("text-5xl font-semibold tabular-nums", toneText[headlineTone])}>
              {headline.value}
            </span>
            {headline.grade ? (
              <span
                className={cn(
                  "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide",
                  toneBadge[headlineTone],
                )}
              >
                {headline.grade}
              </span>
            ) : null}
          </div>
          {headline.sublabel ? (
            <p className="mt-2 text-xs leading-relaxed text-ink-muted">{headline.sublabel}</p>
          ) : null}
        </div>

        {/* Stat mini-cards */}
        {stats.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-ink-base/10 bg-surface-panel/50 p-3.5"
              >
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-muted">
                  {stat.label}
                </p>
                <p
                  className={cn(
                    "mt-1.5 text-2xl font-semibold tabular-nums",
                    stat.tone ? toneText[stat.tone] : "text-ink-strong",
                  )}
                >
                  {stat.value}
                </p>
                {stat.sublabel ? (
                  <p className="mt-0.5 text-[11px] text-ink-muted">{stat.sublabel}</p>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* Needs your attention */}
      {attention.length > 0 ? (
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">
            {attentionTitle}
          </p>
          <ul className="mt-2 divide-y divide-ink-base/10 overflow-hidden rounded-2xl border border-ink-base/10 bg-surface-panel/40">
            {attention.map((item, index) => (
              <li
                key={`${item.label}-${index}`}
                className="flex items-center gap-3 px-4 py-3"
              >
                <span
                  className={cn("size-2 shrink-0 rounded-full", toneDot[item.tone ?? "neutral"])}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink-strong">{item.label}</p>
                  {item.detail ? (
                    <p className="truncate text-xs text-ink-muted">{item.detail}</p>
                  ) : null}
                </div>
                {item.href ? (
                  <Link
                    href={item.href}
                    className="shrink-0 rounded-full bg-accent-brass/12 px-3 py-1.5 text-xs font-semibold text-accent-brass transition-colors hover:bg-accent-brass/20"
                  >
                    {item.actionLabel ?? "Fix"} →
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
