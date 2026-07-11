/**
 * Cockpit status tones — HONEST health colors, deliberately separate from the
 * brass chrome accent so a tool always shows true status at a glance. Values
 * come from the shipped dark palette tokens (AA on the #1A1512 ground). Status
 * is never color-alone: callers always pair these with a text label.
 */
export type CockpitTone = "good" | "warn" | "bad" | "info" | "brass" | "neutral";

/** Solid text color for a tone. */
export const toneText: Record<CockpitTone, string> = {
  good: "text-tone-green",
  warn: "text-tone-amber",
  bad: "text-tone-danger",
  info: "text-tone-blue",
  brass: "text-accent-brass",
  neutral: "text-ink-muted",
};

/** Pill/badge background + text for a tone. */
export const toneBadge: Record<CockpitTone, string> = {
  good: "bg-tone-green-tint text-tone-green",
  warn: "bg-tone-amber-tint text-tone-amber",
  bad: "bg-tone-danger/15 text-tone-danger",
  info: "bg-tone-blue-tint text-tone-blue",
  brass: "bg-accent-brass/15 text-accent-brass",
  neutral: "bg-surface-panel text-ink-muted",
};

/** Small decorative status dot (aria-hidden; text always carries the meaning). */
export const toneDot: Record<CockpitTone, string> = {
  good: "bg-tone-green",
  warn: "bg-tone-amber",
  bad: "bg-tone-danger",
  info: "bg-tone-blue",
  brass: "bg-accent-brass",
  neutral: "bg-ink-base/40",
};
