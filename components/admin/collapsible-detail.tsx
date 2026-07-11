"use client";

import { useId, useState, type ReactNode } from "react";

import { toneBadge, toneDot, type CockpitTone } from "@/components/admin/cockpit-tone";
import { cn } from "@/lib/utils";

/**
 * A slim one-line row (status dot + label + score badge + chevron) that expands
 * on demand — the pattern that replaces endless stacked cards. The heavy detail
 * only renders its height when opened. Expand animation is honored via CSS grid
 * rows and disabled under prefers-reduced-motion (content still toggles).
 */
type CollapsibleDetailProps = {
  label: string;
  /** Small muted context shown next to the label (e.g. slug, count). */
  meta?: string;
  /** Status/score shown on the collapsed row — carries text, never color alone. */
  badge?: { label: ReactNode; tone?: CockpitTone };
  /** Optional leading status dot. */
  leadingDot?: CockpitTone;
  defaultOpen?: boolean;
  children: ReactNode;
};

export function CollapsibleDetail({
  label,
  meta,
  badge,
  leadingDot,
  defaultOpen = false,
  children,
}: CollapsibleDetailProps) {
  const [open, setOpen] = useState(defaultOpen);
  const regionId = useId();

  return (
    <div className="overflow-hidden rounded-2xl border border-ink-base/12 bg-surface-card/70">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={regionId}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-panel/60"
      >
        {leadingDot ? (
          <span className={cn("size-2 shrink-0 rounded-full", toneDot[leadingDot])} aria-hidden />
        ) : null}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-ink-strong">{label}</span>
          {meta ? <span className="block truncate text-xs text-ink-muted">{meta}</span> : null}
        </span>
        {badge ? (
          <span
            className={cn(
              "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums",
              toneBadge[badge.tone ?? "neutral"],
            )}
          >
            {badge.label}
          </span>
        ) : null}
        <svg
          viewBox="0 0 20 20"
          className={cn(
            "size-4 shrink-0 text-ink-muted transition-transform duration-300 motion-reduce:transition-none",
            open && "rotate-180",
          )}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden
        >
          <path d="M5 7.5 10 12.5 15 7.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div
        id={regionId}
        role="region"
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div className="border-t border-ink-base/10 px-4 py-3 text-sm text-ink-muted">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
