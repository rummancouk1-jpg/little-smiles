// Shared Golden Hour vocabulary for the admin operating system — the same
// tokenized, SCAN-first language as components/contentops/contentops-ui.tsx,
// generalized for the analytics/report/readiness surfaces. Server-safe (no
// client hooks): collapsibles are native <details>, gauges are inline SVG.
//
// Everything here is presentation only. It renders values the pages compute;
// it never derives or mutates data.

import type { ReactNode } from "react";

/* ------------------------------------------------------------------ tones */

/** Canonical status tone — maps any domain level onto one visual language. */
export type Tone = "positive" | "info" | "warning" | "critical" | "neutral";

const TONE_CLASS: Record<Tone, string> = {
  positive: "bg-tone-green-tint text-tone-green-deep",
  info: "bg-tone-blue-tint text-tone-blue",
  warning: "bg-tone-amber-tint text-tone-amber",
  critical: "bg-emphasis-berry-tint text-tone-danger",
  neutral: "bg-surface-raised text-ink-base",
};

const TONE_DOT: Record<Tone, string> = {
  positive: "bg-tone-green",
  info: "bg-tone-blue",
  warning: "bg-tone-amber",
  critical: "bg-tone-danger",
  neutral: "bg-ink-base/40",
};

const TONE_ACCENT: Record<Tone, string> = {
  positive: "border-tone-green/30",
  info: "border-tone-blue/30",
  warning: "border-tone-amber/35",
  critical: "border-tone-danger/30",
  neutral: "border-ink-base/15",
};

export function toneClass(tone: Tone): string {
  return TONE_CLASS[tone];
}

/** Diagnostic severity → tone. `ok` reads as positive. */
export function severityTone(severity: "critical" | "warning" | "info" | "ok"): Tone {
  if (severity === "critical") return "critical";
  if (severity === "warning") return "warning";
  if (severity === "info") return "info";
  return "positive";
}

export function severityToneClass(severity: "critical" | "warning" | "info" | "ok"): string {
  return TONE_CLASS[severityTone(severity)];
}

/** Score band → tone, matching the existing 90/75/60 thresholds. */
export function scoreTone(score: number): Tone {
  if (score >= 90) return "positive";
  if (score >= 75) return "info";
  if (score >= 60) return "warning";
  return "critical";
}

export function scoreToneClass(score: number): string {
  return TONE_CLASS[scoreTone(score)];
}

/* ------------------------------------------------------------------ pills */

/** A tone pill with a leading dot — state as colour + shape, read at a glance. */
export function TonePill({
  tone,
  children,
  className = "",
}: {
  tone: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${TONE_CLASS[tone]} ${className}`}
    >
      <span aria-hidden className={`size-1.5 rounded-full ${TONE_DOT[tone]}`} />
      {children}
    </span>
  );
}

/* ------------------------------------------------------------- score dial */

/**
 * At-a-glance composite score — a marigold arc on the paper track with the
 * number in the display serif and the letter grade beneath. Pure SVG so it
 * stays a server component and themes automatically.
 */
export function ScoreDial({
  score,
  grade,
  max = 100,
  size = 96,
}: {
  score: number;
  grade?: string;
  max?: number;
  size?: number;
}) {
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, score / max));
  const dash = pct * c;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-ink-base/12"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          className="text-accent-marigold"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-heading text-2xl font-semibold leading-none tabular-nums text-ink-strong">
          {score}
        </span>
        {grade ? (
          <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-base/55">
            Grade {grade}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- mini bar */

/** A thin score bar for sub-metrics (e.g. the SEO pillar strip). */
export function MiniBar({
  label,
  value,
  max = 100,
}: {
  label: string;
  value: number;
  max?: number;
}) {
  const pct = Math.max(0, Math.min(1, value / max)) * 100;
  const tone = scoreTone(value);
  const fill =
    tone === "positive"
      ? "bg-tone-green"
      : tone === "info"
        ? "bg-tone-blue"
        : tone === "warning"
          ? "bg-tone-amber"
          : "bg-tone-danger";
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[11px] font-medium text-ink-base/72">{label}</span>
        <span className="text-[11px] font-semibold tabular-nums text-ink-strong">{value}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-base/10">
        <div className={`h-full rounded-full ${fill}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- stat tile */

/** A compact label + big number tile for count rows. */
export function StatTile({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: Tone;
}) {
  return (
    <div className="rounded-2xl border border-ink-base/10 bg-surface-raised/55 p-3">
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-ink-base/55">{label}</p>
      <p className="mt-1 font-heading text-2xl font-semibold tabular-nums text-ink-strong">{value}</p>
      {sub ? <p className="mt-0.5 text-[11px] text-ink-base/60">{sub}</p> : null}
      {tone !== "neutral" ? (
        <span aria-hidden className={`mt-2 block h-1 w-8 rounded-full ${TONE_DOT[tone]}`} />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------- verdict banner */

/**
 * "Lead with the answer" — the prominent top-of-page card: overall verdict +
 * the top things to act on, with an optional aside (ScoreDial / key stat).
 */
export function VerdictBanner({
  tone,
  eyebrow,
  title,
  summary,
  actions,
  aside,
}: {
  tone: Tone;
  eyebrow?: string;
  title: string;
  summary?: string;
  actions?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section
      className={`rounded-3xl border bg-surface-card/90 p-5 shadow-card-rest sm:p-7 ${TONE_ACCENT[tone]}`}
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span aria-hidden className={`size-2 rounded-full ${TONE_DOT[tone]}`} />
            <p className="eyebrow">{eyebrow ?? "Verdict"}</p>
          </div>
          <h2 className="mt-2 font-heading text-2xl font-semibold text-ink-strong">{title}</h2>
          {summary ? <p className="mt-1 text-sm text-ink-base/72">{summary}</p> : null}
          {actions ? <div className="mt-4">{actions}</div> : null}
        </div>
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- collapse */

/**
 * Standard "N items — expand" disclosure. Native <details> so it works with
 * no client JS; the header carries a tone chip / count so the operator reads
 * the signal without opening it.
 */
export function Collapse({
  summary,
  count,
  countTone = "neutral",
  defaultOpen = false,
  children,
}: {
  summary: string;
  count?: ReactNode;
  countTone?: Tone;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-2xl border border-ink-base/10 bg-surface-card/90 shadow-card-rest [&_summary::-webkit-details-marker]:hidden"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-5 py-4 hover:bg-surface-hover/40">
        <span className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="text-ink-base/40 transition-transform duration-200 group-open:rotate-90"
          >
            ▶
          </span>
          <span className="font-heading text-base font-semibold text-ink-strong">{summary}</span>
        </span>
        {count != null ? (
          <span
            className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${TONE_CLASS[countTone]}`}
          >
            {count}
          </span>
        ) : null}
      </summary>
      <div className="border-t border-ink-base/10 px-5 py-4">{children}</div>
    </details>
  );
}
