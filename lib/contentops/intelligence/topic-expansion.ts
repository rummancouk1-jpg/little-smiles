// Autonomous topic expansion. Given a published article, deterministically
// suggest 4–6 follow-up topics that reinforce the same topical cluster.
// No AI call here — the topic engine that later turns these into drafts
// already runs Anthropic; the suggestion layer is pure heuristics so the
// dashboard stays fast and predictable.
//
// Each suggestion carries the same fields the topics table accepts, so
// the API route can write them directly. The suggestion engine never
// returns a topic title that already exists in the candidate list — the
// caller passes the current topics to dedupe against.

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

export type TopicSuggestion = {
  title: string;
  format: TopicFormat;
  intent: TopicIntent;
  seasonality: TopicSeasonality;
  /** Cluster the suggestion belongs to — always equals the source article's cluster. */
  cluster: TopicalCluster;
  /** One-line rationale for the operator. */
  rationale: string;
};

type Args = {
  /** Article we're expanding from. */
  article: BlogPost;
  /** Existing topic titles in the queue — used to dedupe. */
  existingTopicTitles: string[];
  /** Slugs of articles already published — used to dedupe titles vs live articles too. */
  existingArticleTitles: string[];
  /** Optional override on how many suggestions to emit. Default 5. */
  limit?: number;
};

// Helpers ------------------------------------------------------------

function primaryKeyword(article: BlogPost): string {
  const first = article.keywords.find((k) => k && k.trim().length > 0);
  return (first ?? article.title).trim();
}

function dedupedAppend(
  out: TopicSuggestion[],
  blocked: Set<string>,
  s: TopicSuggestion,
) {
  const key = s.title.toLowerCase().trim();
  if (blocked.has(key)) return;
  blocked.add(key);
  out.push(s);
}

// Cluster-specific expansion sets. Each entry templates a follow-up
// title that's natural to publish alongside the source article. Keep
// these tight and editorial — no spammy combinatorics.

type ClusterPlaybook = {
  /** Templates take {keyword} and {clusterNoun}. */
  supporting: string[];
  comparison: string[];
  faq: string[];
  seasonal: string[];
};

const CLUSTER_PLAYBOOK: Record<TopicalCluster, ClusterPlaybook> = {
  Sleep: {
    supporting: [
      "Setting up a calm bedtime routine for newborns",
      "Preventing overheating during night sleep",
      "Choosing the right sleepwear for {keyword}",
    ],
    comparison: ["Muslin vs cotton swaddles for {keyword}"],
    faq: ["FAQ: common newborn sleep questions for parents"],
    seasonal: ["{keyword} essentials for the summer months in Pakistan"],
  },
  Feeding: {
    supporting: [
      "Establishing a feeding routine in the first three months",
      "How to read your baby's hunger and fullness cues",
      "Soothing fussy feeders calmly",
    ],
    comparison: ["Feeding cushion vs nursing pillow for {keyword}"],
    faq: ["FAQ: feeding questions every new parent asks"],
    seasonal: ["Feeding essentials for summer outings in Pakistan"],
  },
  Wardrobe: {
    supporting: [
      "Building a calm newborn wardrobe capsule",
      "Caring for organic cotton bodysuits at home",
      "Layering basics for changing weather",
    ],
    comparison: ["Organic cotton vs bamboo bodysuits for {keyword}"],
    faq: ["FAQ: newborn clothing sizes and fabrics"],
    seasonal: ["Winter newborn clothing guide for Pakistan"],
  },
  Outings: {
    supporting: [
      "Diaper bag essentials for short outings",
      "Travelling with a newborn — a calm starter guide",
      "Preparing your bag the night before",
    ],
    comparison: ["Food bag vs insulated bottle case for {keyword}"],
    faq: ["FAQ: travelling out with a baby for the first time"],
    seasonal: ["Monsoon-ready outing kit for Pakistani parents"],
  },
  Gifting: {
    supporting: [
      "Premium baby gift basket ideas under PKR 5,000",
      "Thoughtful first-baby gifts mothers actually use",
      "Personalising small baby gifts calmly",
    ],
    comparison: ["Curated baby box vs single-item gift for {keyword}"],
    faq: ["FAQ: what to gift a new parent in Pakistan"],
    seasonal: ["Eid gifting guide: thoughtful baby gifts"],
  },
  "Newborn Care": {
    supporting: [
      "Newborn essentials checklist for first-time parents",
      "Calm bathing routine for a newborn",
      "Skin-care basics for the first three months",
    ],
    comparison: ["Pre-built newborn kits vs hand-curated essentials for {keyword}"],
    faq: ["FAQ: common newborn questions in the first month"],
    seasonal: ["Newborn essentials for hot weather in Pakistan"],
  },
};

// Seasonality inference: peek at the source article's title/keywords
// for season cues. Falls back to evergreen.
function inferSeasonality(article: BlogPost): TopicSeasonality {
  const text =
    `${article.title} ${article.description} ${article.keywords.join(" ")}`.toLowerCase();
  if (/summer/.test(text)) return "summer";
  if (/winter/.test(text)) return "winter";
  if (/monsoon|rain/.test(text)) return "monsoon";
  if (/eid|gift/.test(text)) return "eid";
  return "evergreen";
}

// Intent inference for each suggestion type. Same intent the source
// article carries usually — comparisons lean informational, FAQ stays
// informational, seasonal leans commercial.
function intentFor(type: keyof ClusterPlaybook): TopicIntent {
  switch (type) {
    case "supporting":
      return "informational";
    case "comparison":
      return "informational";
    case "faq":
      return "informational";
    case "seasonal":
      return "commercial";
  }
}

function fillTemplate(template: string, keyword: string): string {
  return template.replace(/\{keyword\}/g, keyword.toLowerCase());
}

// Entry point --------------------------------------------------------

export function suggestExpansionTopics(args: Args): TopicSuggestion[] {
  const cluster = clusterForCategory(args.article.relatedProductCategory);
  const playbook = CLUSTER_PLAYBOOK[cluster];
  const seasonality = inferSeasonality(args.article);
  const keyword = primaryKeyword(args.article);
  const limit = Math.max(3, Math.min(8, args.limit ?? 5));

  const blocked = new Set<string>(
    [
      args.article.title,
      ...args.existingTopicTitles,
      ...args.existingArticleTitles,
    ].map((t) => t.toLowerCase().trim()),
  );

  const out: TopicSuggestion[] = [];

  function add(
    title: string,
    type: keyof ClusterPlaybook,
    format: TopicFormat,
    rationaleSuffix: string,
  ) {
    if (out.length >= limit) return;
    const filled = fillTemplate(title, keyword);
    dedupedAppend(out, blocked, {
      title: filled,
      format,
      intent: intentFor(type),
      seasonality,
      cluster,
      rationale: `${rationaleSuffix} — reinforces the ${cluster} cluster.`,
    });
  }

  // Priority order: supporting (depth) → comparison (mid-funnel) →
  // faq (snippet eligibility) → seasonal (peak-period earning).
  for (const t of playbook.supporting) add(t, "supporting", "guide", "Supporting article");
  for (const t of playbook.comparison) add(t, "comparison", "comparison", "Comparison article");
  for (const t of playbook.faq) add(t, "faq", "faq", "FAQ article");
  for (const t of playbook.seasonal)
    add(
      t,
      "seasonal",
      "seasonal",
      seasonality === "evergreen" ? "Seasonal expansion" : `Seasonal (${seasonality}) expansion`,
    );

  return out.slice(0, limit);
}
