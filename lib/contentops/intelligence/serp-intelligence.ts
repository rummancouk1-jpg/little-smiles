// SERP intelligence — heuristic-only initial version. Returns calm,
// operator-readable recommendations about article structure, image
// density, schema opportunities, and intent signals.
//
// No scraping, no external SERP API calls. Future commits can swap any
// recommendation source behind the SerpIntelligenceProvider interface
// without changing call sites:
//   - Search Console
//   - Ahrefs / SEMrush
//   - DataForSEO
//   - Google Custom Search
//
// The output is intentionally calibrated: never numeric scores without
// language context, never bullet lists longer than ~6 items, never
// urgency or "you must" framing. Editorial guidance — not directives.

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

export type SerpRecommendationKind =
  | "structure"
  | "imagery"
  | "schema"
  | "intent"
  | "discovery"
  | "seasonal";

export type SerpRecommendation = {
  kind: SerpRecommendationKind;
  /** Short editorial cue, surfaced verbatim. */
  message: string;
};

export type SerpIntelligenceReport = {
  recommendations: SerpRecommendation[];
  /** Recommended target body length, expressed as a range. */
  recommendedWords: { min: number; max: number };
  /** Recommended hero + section image count for this format. */
  recommendedImages: { hero: number; sections: number };
  /** Detected intent classification — surfaced as a calm chip. */
  detectedIntent: "informational" | "commercial" | "comparison" | "navigational";
  /** Schema types worth emitting in the article's JSON-LD block. */
  schemaOpportunities: string[];
};

type Args = {
  post: Pick<
    BlogPost,
    "title" | "description" | "category" | "relatedProductCategory" | "keywords" | "sections"
  >;
  format?: TopicFormat | null;
  intent?: TopicIntent | null;
  seasonality?: TopicSeasonality | null;
};

// ---------------------------------------------------------------------------
// Word-count + image-count targets by format
// ---------------------------------------------------------------------------

const WORDS_BY_FORMAT: Record<TopicFormat, { min: number; max: number }> = {
  guide: { min: 1100, max: 1800 },
  comparison: { min: 900, max: 1500 },
  faq: { min: 600, max: 1100 },
  checklist: { min: 700, max: 1200 },
  seasonal: { min: 900, max: 1500 },
  beginner: { min: 800, max: 1400 },
  best_for: { min: 900, max: 1500 },
  problem_solution: { min: 800, max: 1300 },
};
const WORDS_DEFAULT = { min: 900, max: 1500 };

const IMAGES_BY_FORMAT: Record<TopicFormat, { hero: number; sections: number }> = {
  guide: { hero: 1, sections: 3 },
  comparison: { hero: 1, sections: 4 },
  faq: { hero: 1, sections: 1 },
  checklist: { hero: 1, sections: 2 },
  seasonal: { hero: 1, sections: 3 },
  beginner: { hero: 1, sections: 2 },
  best_for: { hero: 1, sections: 4 },
  problem_solution: { hero: 1, sections: 2 },
};
const IMAGES_DEFAULT = { hero: 1, sections: 2 };

// ---------------------------------------------------------------------------
// Detected intent (lexical hints + topic-format alignment)
// ---------------------------------------------------------------------------

function detectIntent(args: Args): SerpIntelligenceReport["detectedIntent"] {
  const haystack = `${args.post.title} ${args.post.description}`.toLowerCase();
  if (/(vs|versus|compare|comparison)/.test(haystack)) return "comparison";
  if (args.format === "comparison") return "comparison";
  if (args.intent === "commercial" || args.intent === "transactional")
    return "commercial";
  if (args.format === "best_for") return "commercial";
  if (/(login|sign in|sign up|track|order status)/.test(haystack)) return "navigational";
  return "informational";
}

// ---------------------------------------------------------------------------
// Schema opportunities — surfaced as the JSON-LD types worth emitting
// ---------------------------------------------------------------------------

function schemaOpportunities(args: Args): string[] {
  const out = new Set<string>(["Article", "BreadcrumbList"]);
  if (args.format === "faq") out.add("FAQPage");
  if (args.format === "comparison") out.add("ItemList");
  if (args.format === "checklist") out.add("HowTo");
  if (args.format === "best_for") out.add("ItemList");
  const intent = detectIntent(args);
  if (intent === "commercial" || intent === "comparison") out.add("Product");
  return [...out];
}

// ---------------------------------------------------------------------------
// Recommendations composer
// ---------------------------------------------------------------------------

function pushIfDistinct(out: SerpRecommendation[], next: SerpRecommendation) {
  if (out.some((r) => r.message === next.message)) return;
  out.push(next);
}

function imageCueFor(args: Args, recommendedImages: { sections: number }): string {
  const cluster = clusterForCategory(args.post.relatedProductCategory);
  const total = 1 + recommendedImages.sections;
  return `High-ranking ${cluster.toLowerCase()} pages usually carry around ${total} image${total === 1 ? "" : "s"} — one hero plus ${recommendedImages.sections} section visual${recommendedImages.sections === 1 ? "" : "s"}.`;
}

function pinterestSignal(args: Args, cluster: TopicalCluster): SerpRecommendation | null {
  const pinterestStrongClusters: TopicalCluster[] = [
    "Wardrobe",
    "Gifting",
    "Sleep",
    "Newborn Care",
  ];
  if (!pinterestStrongClusters.includes(cluster)) return null;
  return {
    kind: "discovery",
    message: "Pinterest-friendly topic — consider a vertical 2:3 pin variant alongside the hero.",
  };
}

function seasonalSignal(args: Args): SerpRecommendation | null {
  if (!args.seasonality || args.seasonality === "evergreen") return null;
  const map: Record<Exclude<TopicSeasonality, "evergreen">, string> = {
    summer: "Search demand peaks April–August. Plan the publish window accordingly.",
    winter: "Search demand peaks November–February. Plan the publish window accordingly.",
    monsoon: "Search demand peaks June–September in Pakistan.",
    eid: "Search demand spikes in the 2–3 weeks before each Eid. Stage publishing close to the lunar dates.",
  };
  return { kind: "seasonal", message: map[args.seasonality] };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function inferSerpIntelligence(args: Args): SerpIntelligenceReport {
  const cluster = clusterForCategory(args.post.relatedProductCategory);
  const recommendedWords = args.format
    ? WORDS_BY_FORMAT[args.format] ?? WORDS_DEFAULT
    : WORDS_DEFAULT;
  const recommendedImages = args.format
    ? IMAGES_BY_FORMAT[args.format] ?? IMAGES_DEFAULT
    : IMAGES_DEFAULT;
  const detectedIntent = detectIntent(args);
  const schema = schemaOpportunities(args);

  const recs: SerpRecommendation[] = [];

  // Structure — current section count.
  const sectionCount = args.post.sections.length;
  if (sectionCount < 3) {
    pushIfDistinct(recs, {
      kind: "structure",
      message: `Article has ${sectionCount} section${sectionCount === 1 ? "" : "s"}. Pages that rank for this kind of query usually carry 4–6 sections.`,
    });
  } else if (sectionCount > 8) {
    pushIfDistinct(recs, {
      kind: "structure",
      message: `Article has ${sectionCount} sections. Consider consolidating — 4–6 sections read better and earn richer snippets.`,
    });
  }

  // Imagery target.
  pushIfDistinct(recs, {
    kind: "imagery",
    message: imageCueFor(args, recommendedImages),
  });

  // Intent.
  if (detectedIntent === "comparison") {
    pushIfDistinct(recs, {
      kind: "intent",
      message: "Comparison intent detected — a clear two-column comparison block helps both readers and SERPs.",
    });
  }
  if (detectedIntent === "commercial") {
    pushIfDistinct(recs, {
      kind: "intent",
      message: "Commercial intent detected — anchor a single product clearly; avoid over-listing alternatives.",
    });
  }

  // Format-specific opportunities.
  if (args.format === "faq") {
    pushIfDistinct(recs, {
      kind: "schema",
      message: "FAQ opportunity — embed FAQPage JSON-LD to earn featured-snippet eligibility.",
    });
  }
  if (args.format === "checklist") {
    pushIfDistinct(recs, {
      kind: "schema",
      message: "HowTo opportunity — checklist articles benefit from HowTo JSON-LD.",
    });
  }

  // Pinterest signal.
  const pin = pinterestSignal(args, cluster);
  if (pin) pushIfDistinct(recs, pin);

  // Seasonal.
  const seasonal = seasonalSignal(args);
  if (seasonal) pushIfDistinct(recs, seasonal);

  return {
    recommendations: recs.slice(0, 6),
    recommendedWords,
    recommendedImages,
    detectedIntent,
    schemaOpportunities: schema,
  };
}
