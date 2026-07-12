// Corpus awareness for the drafting model + a duplicate-intent guard.
// Fixes the audit failure where the CLI happily generated a near-duplicate
// of an existing live post (same intent, identical keywords) because
// conflict detection only checks exact slug/title.

import { type BlogPost } from "@/lib/contentops/blog-schema";

export type CorpusEntry = {
  slug: string;
  title: string;
  keywords: string[];
};

// Low-signal for THIS store: geo + generic baby/guide words that appear
// across almost every post, so they can't discriminate one topic from
// another. The discriminating tokens are subjects (swaddle, bodysuit,
// fabric, feeding) and actions (choose, wash, swaddle).
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "for", "to", "of", "in", "on", "with",
  "your", "you", "how", "what", "best", "guide", "pakistan", "pakistani",
  "baby", "newborn", "parents", "parent", "tips",
]);

/** Light singularization so "summers"/"summer", "fabrics"/"fabric" match. */
function singularize(word: string): string {
  if (word.length > 4 && word.endsWith("s") && !word.endsWith("ss")) {
    return word.slice(0, -1);
  }
  return word;
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w))
      .map(singularize),
  );
}

/**
 * Duplicate-intent signal = CONTAINMENT: what fraction of the proposed
 * topic's meaningful tokens are already covered by this post. Jaccard was
 * wrong here — it penalized longer posts, so an exact-intent duplicate of
 * a rich existing post scored low. Containment asks the real question:
 * "is the thing I want to write already covered?"
 */
function overlapScore(topicTokens: Set<string>, entry: CorpusEntry): number {
  const entryTokens = tokenize([entry.title, ...entry.keywords].join(" "));
  if (entryTokens.size === 0 || topicTokens.size === 0) return 0;
  let shared = 0;
  for (const t of topicTokens) if (entryTokens.has(t)) shared++;
  return shared / topicTokens.size;
}

export type TopicOverlap = { slug: string; title: string; score: number };

/**
 * Rank existing posts by intent overlap with a proposed topic. A score at
 * or above ~0.4 means "you already cover this" — the CLI aborts before
 * spending tokens, so the operator refreshes the existing post instead of
 * splitting its ranking signal.
 */
export function findTopicOverlap(topic: string, corpus: CorpusEntry[]): TopicOverlap[] {
  const topicTokens = tokenize(topic);
  return corpus
    .map((entry) => ({ slug: entry.slug, title: entry.title, score: overlapScore(topicTokens, entry) }))
    .filter((o) => o.score > 0)
    .sort((a, b) => b.score - a.score);
}

/**
 * Hard-block threshold — deliberately high (near-certain duplicate). A
 * pre-check should refuse only obvious dups; lexical containment can't tell
 * "shares the subject" from "shares the season" (bodysuits-in-summer vs
 * swaddle-in-summer both hit ~67%), so borderline topics proceed and the
 * prompt-level corpus brief tells the model not to duplicate. The exact
 * audit failure scored 100%, so it still blocks.
 */
export const DUPLICATE_INTENT_THRESHOLD = 0.8;
/** Below the block but worth a heads-up in the CLI. */
export const DUPLICATE_INTENT_WARN = 0.5;

/**
 * A compact list of existing posts for the prompt: gives the model real
 * blog slugs to link to AND the coverage it must NOT duplicate.
 */
export function buildCorpusBrief(corpus: CorpusEntry[]): string {
  if (corpus.length === 0) {
    return "EXISTING POSTS: none yet. Do not link to any /blog/<slug> (none exist).";
  }
  const lines = corpus.map(
    (e) => `- "${e.title}" (/blog/${e.slug}) — keywords: ${e.keywords.join(", ")}`,
  );
  return [
    "EXISTING POSTS (link to these real slugs where relevant; do NOT write a near-duplicate of any):",
    ...lines,
    "If your topic substantially overlaps one of these, choose a distinct angle or a more specific long-tail intent.",
  ].join("\n");
}
