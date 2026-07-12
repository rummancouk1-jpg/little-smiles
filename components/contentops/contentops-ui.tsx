// Shared visual vocabulary for the ContentOps authoring surface. Tokenized
// (Golden Hour) so it warms up and themes in dark mode automatically; built
// to be SCANNED, not read — status as colour + shape, pipeline as a stage
// strip, numbers in the display serif. Server-safe (no client hooks).

import Link from "next/link";

import type { CritiqueResult, CritiqueSeverity } from "@/lib/contentops/critique";
import type { DraftStatus, DraftStatusCounts } from "@/lib/contentops/drafts-store";

type StatusTone = {
  label: string;
  /** tailwind: bg tint + text tone (both token-backed → theme-aware). */
  className: string;
  dot: string;
};

export const STATUS_TONE: Record<DraftStatus, StatusTone> = {
  pending_review: {
    label: "Pending review",
    className: "bg-tone-blue-tint text-tone-blue",
    dot: "bg-tone-blue",
  },
  approved: {
    label: "Approved",
    className: "bg-tone-green-tint text-tone-green-deep",
    dot: "bg-tone-green",
  },
  published: {
    label: "Published",
    className: "bg-mat-butter text-ink-strong",
    dot: "bg-accent-marigold",
  },
  rejected: {
    label: "Rejected",
    className: "bg-emphasis-berry-tint text-tone-danger",
    dot: "bg-tone-danger",
  },
};

/** A status pill — colour + a leading dot so state reads at a glance. */
export function StatusPill({ status }: { status: DraftStatus }) {
  const tone = STATUS_TONE[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${tone.className}`}
    >
      <span aria-hidden className={`size-1.5 rounded-full ${tone.dot}`} />
      {tone.label}
    </span>
  );
}

/**
 * The pipeline at a glance — the happy path (Pending → Approved → Published)
 * as connected stage cards, with Rejected as a muted aside. The daily
 * landing needs this to answer "what's waiting on me?" in one look.
 */
export function PipelineOverview({
  counts,
  baseHref,
  activeStatus,
}: {
  counts: DraftStatusCounts;
  baseHref: string;
  activeStatus: DraftStatus | "all";
}) {
  const flow: DraftStatus[] = ["pending_review", "approved", "published"];

  return (
    <div className="rounded-3xl border border-ink-base/10 bg-surface-card/90 p-5 shadow-card-rest sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="eyebrow">Pipeline</p>
        <Link
          href={baseHref}
          className={`text-[11px] font-medium underline-offset-2 hover:underline ${
            activeStatus === "all" ? "text-ink-strong" : "text-ink-base/60"
          }`}
        >
          All {counts.all}
        </Link>
      </div>
      <div className="mt-4 flex items-stretch gap-2 overflow-x-auto pb-1 sm:gap-3">
        {flow.map((status, index) => (
          <div key={status} className="flex items-stretch gap-2 sm:gap-3">
            <StageCard status={status} count={counts[status]} baseHref={baseHref} active={activeStatus === status} />
            {index < flow.length - 1 ? (
              <span aria-hidden className="flex items-center text-ink-base/30">
                →
              </span>
            ) : null}
          </div>
        ))}
        <span aria-hidden className="flex items-center text-ink-base/20">
          |
        </span>
        <StageCard
          status="rejected"
          count={counts.rejected}
          baseHref={baseHref}
          active={activeStatus === "rejected"}
          muted
        />
      </div>
    </div>
  );
}

const CRITIQUE_SEVERITY_TONE: Record<CritiqueSeverity, { chip: string; dot: string; label: string }> = {
  critical: { chip: "bg-emphasis-berry-tint text-tone-danger", dot: "bg-tone-danger", label: "Critical" },
  warning: { chip: "bg-tone-amber-tint text-tone-amber", dot: "bg-tone-amber", label: "Check" },
  info: { chip: "bg-tone-blue-tint text-tone-blue", dot: "bg-tone-blue", label: "Note" },
};

/**
 * Opus critique card — surfaces the pre-review flags so the human reviewer
 * knows what to look at before diving in. Advisory only: nothing here
 * auto-fixes or blocks; the human still edits and approves.
 */
export function CritiqueCard({ critique }: { critique: CritiqueResult | null }) {
  if (!critique) {
    return (
      <section className="rounded-3xl border border-dashed border-ink-base/20 bg-surface-card/70 p-5 text-sm text-ink-base/60 sm:p-6">
        <p className="eyebrow">AI critique</p>
        <p className="mt-2">
          No critique on this draft. New drafts get an automatic Opus pre-review; older
          drafts pre-date it.
        </p>
      </section>
    );
  }

  const order: CritiqueSeverity[] = ["critical", "warning", "info"];
  const flags = [...critique.flags].sort(
    (a, b) => order.indexOf(a.severity) - order.indexOf(b.severity),
  );

  return (
    <section className="rounded-3xl border border-ink-base/10 bg-surface-card/90 p-5 shadow-card-rest sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="eyebrow">AI critique — reviewer checklist</p>
        <span className="text-[11px] text-ink-base/50">
          {critique.model} · advisory, not a gate
        </span>
      </div>

      {flags.length === 0 ? (
        <p className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-tone-green-deep">
          <span aria-hidden className="size-2 rounded-full bg-tone-green" />
          No issues flagged — still your call to review and approve.
        </p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {flags.map((flag, index) => {
            const tone = CRITIQUE_SEVERITY_TONE[flag.severity];
            return (
              <li
                key={index}
                className="flex gap-3 rounded-2xl border border-ink-base/8 bg-surface-raised/55 p-3.5"
              >
                <span aria-hidden className={`mt-1.5 size-2 shrink-0 rounded-full ${tone.dot}`} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${tone.chip}`}
                    >
                      {tone.label}
                    </span>
                    <span className="text-[11px] font-medium text-ink-base/60">
                      {flag.location}
                    </span>
                    <span className="text-[11px] text-ink-base/40">· {flag.category.replace(/_/g, " ")}</span>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-ink-base/80">{flag.note}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function StageCard({
  status,
  count,
  baseHref,
  active,
  muted,
}: {
  status: DraftStatus;
  count: number;
  baseHref: string;
  active: boolean;
  muted?: boolean;
}) {
  const tone = STATUS_TONE[status];
  return (
    <Link
      href={`${baseHref}?status=${status}`}
      className={[
        "flex min-w-[7.5rem] flex-col rounded-2xl border px-4 py-3 transition-[transform,border-color,background-color] duration-200 hover:-translate-y-0.5",
        active
          ? "border-ink-base/28 bg-surface-raised"
          : "border-ink-base/10 bg-surface-raised/55 hover:border-ink-base/20",
        muted ? "opacity-80" : "",
      ].join(" ")}
    >
      <span className="flex items-center gap-1.5">
        <span aria-hidden className={`size-1.5 rounded-full ${tone.dot}`} />
        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-base/60">
          {tone.label}
        </span>
      </span>
      <span className="mt-1.5 font-heading text-3xl font-semibold tabular-nums text-ink-strong">
        {count}
      </span>
    </Link>
  );
}
