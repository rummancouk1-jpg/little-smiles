// Visual style intelligence. Pure deterministic module — no API calls,
// no scraping. Given a topic's editorial context, returns calm visual
// direction the operator (or the prompt composer) can use to decide
// composition, color, framing, and Pinterest suitability.
//
// Why deterministic: the operator-facing card needs to be reliable and
// repeatable. An AI-driven style suggestion would feel different every
// time and undermine "calm editorial" feel. Future commits can layer a
// learned reranker on top of these heuristics without restructuring.
//
// Inputs are intentionally minimal — title + cluster + format +
// seasonality + intent — so the module is consumable from drafts, from
// the topic intelligence layer, and from the SERP intelligence layer
// without coupling.

import type { BlogPost } from "@/lib/contentops/blog-schema";
import {
  clusterForCategory,
  type TopicalCluster,
} from "@/lib/contentops/intelligence/clusters";
import type {
  TopicFormat,
  TopicIntent,
  TopicSeasonality,
} from "@/lib/contentops/topics-store";

export type VisualStyleAspect = "16:9" | "1:1" | "1200x630" | "2:3";

export type EmotionalTone =
  | "calm"
  | "warm"
  | "reassuring"
  | "celebratory"
  | "practical";

export type Composition =
  | "candid-portrait"
  | "fabric-close-up"
  | "flat-lay"
  | "window-light-scene"
  | "nursery-corner"
  | "lifestyle-vignette";

export type VisualStyleSuggestion = {
  /** One-line summary the card surfaces verbatim. */
  headline: string;
  composition: Composition;
  tone: EmotionalTone;
  /** 3–5 short concrete framing cues — surfaced as a bullet list. */
  framingCues: string[];
  /** 3–4 palette hints in plain English. */
  paletteCues: string[];
  /** Preferred aspect for the article hero. */
  preferredAspect: VisualStyleAspect;
  /** 0..100 — how well this topic suits Pinterest discovery. */
  pinterestSuitability: number;
};

type IntelArgs = {
  post: Pick<BlogPost, "title" | "description" | "category" | "relatedProductCategory" | "keywords">;
  format?: TopicFormat | null;
  intent?: TopicIntent | null;
  seasonality?: TopicSeasonality | null;
};

// ---------------------------------------------------------------------------
// Cluster → default style. Each cluster gets a calm baseline.
// ---------------------------------------------------------------------------

const CLUSTER_DEFAULT: Record<
  TopicalCluster,
  {
    composition: Composition;
    tone: EmotionalTone;
    paletteCues: string[];
  }
> = {
  Sleep: {
    composition: "window-light-scene",
    tone: "calm",
    paletteCues: ["dusty rose", "warm cream", "soft sage", "candlelight"],
  },
  Feeding: {
    composition: "candid-portrait",
    tone: "warm",
    paletteCues: ["golden hour", "warm beige", "milky cream", "soft clay"],
  },
  Wardrobe: {
    composition: "fabric-close-up",
    tone: "practical",
    paletteCues: ["bone white", "natural linen", "muted sage", "soft ochre"],
  },
  Outings: {
    composition: "lifestyle-vignette",
    tone: "reassuring",
    paletteCues: ["warm tan", "soft denim blue", "pale gold", "cream"],
  },
  Gifting: {
    composition: "flat-lay",
    tone: "celebratory",
    paletteCues: ["champagne", "dusty pink", "ivory", "subtle gold accent"],
  },
  "Newborn Care": {
    composition: "nursery-corner",
    tone: "reassuring",
    paletteCues: ["off-white", "powder pink", "soft mint", "warm beige"],
  },
};

// ---------------------------------------------------------------------------
// Format-specific framing nudges
// ---------------------------------------------------------------------------

const FORMAT_FRAMING: Partial<Record<TopicFormat, string[]>> = {
  comparison: [
    "two-subject side-by-side flat-lay",
    "even, diffused lighting so neither subject reads as preferred",
    "neutral surface with subtle texture",
  ],
  checklist: [
    "tidy flat-lay with organized clusters of items",
    "soft top-down angle",
    "muted background to keep focus on the grouping",
  ],
  faq: [
    "calm question-framing visual — parent + baby in a thoughtful moment",
    "soft natural light",
    "no overt commercial styling",
  ],
  seasonal: [
    "scene cues that visually anchor the season (light direction, fabric weight, palette warmth)",
    "single warm focal subject, breathing room around it",
  ],
  best_for: [
    "one product in clear focus, lifestyle context just behind",
    "shallow depth of field",
    "honest, unstyled feel",
  ],
  problem_solution: [
    "two-beat composition: gentle concern + resolved calm",
    "soft window light",
    "no exaggerated emotion",
  ],
  beginner: [
    "warm parent-and-baby moment",
    "approachable, slightly cropped framing",
    "no expert-coded sterile cues",
  ],
  guide: [
    "single clear subject with editorial breathing room",
    "natural light, soft shadows",
    "minimal styling",
  ],
};

// ---------------------------------------------------------------------------
// Seasonal palette overrides — applied additively after cluster defaults.
// ---------------------------------------------------------------------------

const SEASONAL_PALETTE: Partial<Record<TopicSeasonality, string[]>> = {
  summer: ["bright cream", "soft mint", "pale terracotta"],
  winter: ["warm ochre", "rosy beige", "honey", "soft camel"],
  monsoon: ["overcast silver", "soft sage", "warm grey"],
  eid: ["champagne", "warm gold accent", "deep cream", "dusk rose"],
};

// ---------------------------------------------------------------------------
// Pinterest suitability — heuristic 0..100
// ---------------------------------------------------------------------------

function pinterestScore(args: IntelArgs): number {
  const cluster = clusterForCategory(args.post.relatedProductCategory);

  // Cluster baselines (Pinterest is strongest on lifestyle + visual
  // verticals; weaker on dense informational FAQs).
  const clusterBase: Record<TopicalCluster, number> = {
    Sleep: 78,
    Feeding: 70,
    Wardrobe: 88,
    Outings: 70,
    Gifting: 92,
    "Newborn Care": 80,
  };
  let score = clusterBase[cluster];

  // Format adjustments.
  if (args.format === "best_for") score += 6;
  if (args.format === "seasonal") score += 8;
  if (args.format === "checklist") score += 4;
  if (args.format === "faq") score -= 8;
  if (args.format === "comparison") score -= 4;

  // Intent — commercial slightly stronger than pure informational.
  if (args.intent === "commercial") score += 4;
  if (args.intent === "transactional") score += 2;

  // Seasonality — peak windows raise suitability.
  if (args.seasonality && args.seasonality !== "evergreen") score += 4;

  // Clamp.
  return Math.max(0, Math.min(100, Math.round(score)));
}

function preferredAspect(args: IntelArgs): VisualStyleAspect {
  // If the topic is Pinterest-strong, recommend a vertical hero;
  // otherwise the standard 16:9 article hero.
  return pinterestScore(args) >= 82 ? "2:3" : "16:9";
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function inferVisualStyle(args: IntelArgs): VisualStyleSuggestion {
  const cluster = clusterForCategory(args.post.relatedProductCategory);
  const base = CLUSTER_DEFAULT[cluster];

  const framingFromFormat = args.format ? FORMAT_FRAMING[args.format] ?? [] : [];
  const baseFraming = [
    "soft natural daylight",
    "editorial composition",
    "honest, unposed feel",
  ];
  const framingCues = dedupe([...framingFromFormat, ...baseFraming]).slice(0, 5);

  const seasonal = args.seasonality ? SEASONAL_PALETTE[args.seasonality] ?? [] : [];
  const paletteCues = dedupe([...seasonal, ...base.paletteCues]).slice(0, 4);

  const score = pinterestScore(args);
  const aspect = preferredAspect(args);

  const headline = composeHeadline({
    cluster,
    composition: base.composition,
    tone: base.tone,
    aspect,
    score,
  });

  return {
    headline,
    composition: base.composition,
    tone: base.tone,
    framingCues,
    paletteCues,
    preferredAspect: aspect,
    pinterestSuitability: score,
  };
}

function composeHeadline(args: {
  cluster: TopicalCluster;
  composition: Composition;
  tone: EmotionalTone;
  aspect: VisualStyleAspect;
  score: number;
}): string {
  const compositionLabel: Record<Composition, string> = {
    "candid-portrait": "candid portrait",
    "fabric-close-up": "fabric close-up",
    "flat-lay": "flat-lay",
    "window-light-scene": "window-light scene",
    "nursery-corner": "nursery corner",
    "lifestyle-vignette": "lifestyle vignette",
  };
  const toneLabel: Record<EmotionalTone, string> = {
    calm: "calm",
    warm: "warm",
    reassuring: "reassuring",
    celebratory: "celebratory",
    practical: "practical",
  };
  const pinterestNote = args.score >= 82 ? " — strong Pinterest fit" : "";
  return `${toneLabel[args.tone]}, ${compositionLabel[args.composition]} for the ${args.cluster} cluster${pinterestNote}`;
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const key = v.toLowerCase().trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}
