// Lightweight seasonal-relevance scorer. Pure deterministic function.
// Maps a topic's seasonality + the current month to a 0..100 score the
// admin surfaces use to nudge the editorial queue toward timely topics.
//
// Intentionally not a sophisticated demand model — just a calm signal
// the operator can override at any time by editing `seasonal_relevance`
// on the topic.

import type { TopicSeasonality } from "@/lib/contentops/topics-store";

// Month windows (1-indexed, inclusive both ends) for each seasonality.
// Pakistan-aware: monsoon is July–September, peak summer May–August,
// winter December–February, Eid windows shift each year so we set a
// modest year-round baseline + spike one month before the most common
// dates rather than chasing the lunar calendar here.
const PEAK_MONTHS: Record<Exclude<TopicSeasonality, "evergreen">, number[]> = {
  summer: [5, 6, 7, 8],
  monsoon: [7, 8, 9],
  winter: [12, 1, 2],
  eid: [3, 4, 6, 7], // shifts — these are rough centers across the year
};

const SHOULDER_MONTHS: Record<Exclude<TopicSeasonality, "evergreen">, number[]> = {
  summer: [4, 9],
  monsoon: [6, 10],
  winter: [11, 3],
  eid: [2, 5, 8],
};

/**
 * Score a topic's timeliness today.
 *
 * - Evergreen topics return a flat 50 so they sort below an in-season
 *   topic but above an out-of-season one.
 * - Peak month → 90.
 * - Shoulder month → 65.
 * - Otherwise → 25.
 *
 * Operator override: if the row carries an explicit `seasonal_relevance`,
 * the caller should prefer that. This helper is the fallback signal.
 */
export function seasonalScore(
  seasonality: TopicSeasonality,
  now: Date = new Date(),
): number {
  if (seasonality === "evergreen") return 50;
  const month = now.getMonth() + 1; // 1..12
  if (PEAK_MONTHS[seasonality].includes(month)) return 90;
  if (SHOULDER_MONTHS[seasonality].includes(month)) return 65;
  return 25;
}

/**
 * Convenience: returns whichever of `explicit` or computed-score is
 * appropriate. Explicit operator scores always win.
 */
export function resolveSeasonalScore(args: {
  seasonality: TopicSeasonality;
  explicit: number | null;
  now?: Date;
}): number {
  if (
    typeof args.explicit === "number" &&
    args.explicit >= 0 &&
    args.explicit <= 100
  ) {
    return args.explicit;
  }
  return seasonalScore(args.seasonality, args.now);
}
