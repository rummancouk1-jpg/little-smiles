// Deterministic, explainable topic grouping. Computes Jaccard similarity
// over each blog post's declared `keywords` field. No LLM, no embeddings,
// no opaque scores — the output shows the exact keyword overlap between
// every pair of posts so the operator can see why something is grouped.

import { blogPosts, type BlogPost } from "@/lib/blog";

import type { Diagnostic } from "@/lib/seo-intelligence/types";

const SIMILARITY_THRESHOLD = 0.15;

export type PairwiseOverlap = {
  a: { slug: string; title: string };
  b: { slug: string; title: string };
  sharedKeywords: string[];
  jaccard: number;
};

export type TopicGroup = {
  /** Stable id — sorted slug list joined by '|'. */
  id: string;
  members: { slug: string; title: string }[];
  sharedKeywords: string[];
  derivation: string;
};

export type TopicGroupingReport = {
  pairs: PairwiseOverlap[];
  groups: TopicGroup[];
  isolatedPosts: { slug: string; title: string; reason: string }[];
  globalDiagnostics: Diagnostic[];
};

function normaliseKeywords(post: BlogPost): Set<string> {
  return new Set(post.keywords.map((k) => k.trim().toLowerCase()).filter(Boolean));
}

function jaccard(a: Set<string>, b: Set<string>): { value: number; shared: string[] } {
  const intersection: string[] = [];
  for (const key of a) {
    if (b.has(key)) intersection.push(key);
  }
  const unionSize = new Set([...a, ...b]).size;
  if (unionSize === 0) return { value: 0, shared: [] };
  return { value: intersection.length / unionSize, shared: intersection };
}

export function buildTopicGroupingReport(): TopicGroupingReport {
  const keywordSets = blogPosts.map((post) => ({ post, keywords: normaliseKeywords(post) }));
  const pairs: PairwiseOverlap[] = [];

  for (let i = 0; i < keywordSets.length; i++) {
    for (let j = i + 1; j < keywordSets.length; j++) {
      const left = keywordSets[i];
      const right = keywordSets[j];
      const { value, shared } = jaccard(left.keywords, right.keywords);
      pairs.push({
        a: { slug: left.post.slug, title: left.post.title },
        b: { slug: right.post.slug, title: right.post.title },
        sharedKeywords: shared,
        jaccard: value,
      });
    }
  }

  // Union-find to merge transitive groups above the threshold.
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    while (parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x)!)!);
      x = parent.get(x)!;
    }
    return x;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  for (const post of blogPosts) parent.set(post.slug, post.slug);

  const significantPairs = pairs.filter((p) => p.jaccard >= SIMILARITY_THRESHOLD);
  for (const pair of significantPairs) union(pair.a.slug, pair.b.slug);

  const grouped = new Map<string, string[]>();
  for (const post of blogPosts) {
    const root = find(post.slug);
    if (!grouped.has(root)) grouped.set(root, []);
    grouped.get(root)!.push(post.slug);
  }

  const groups: TopicGroup[] = [];
  const isolatedPosts: TopicGroupingReport["isolatedPosts"] = [];

  for (const [, slugs] of grouped) {
    if (slugs.length === 1) {
      const post = blogPosts.find((p) => p.slug === slugs[0])!;
      isolatedPosts.push({
        slug: post.slug,
        title: post.title,
        reason: `No other post shares ≥ ${SIMILARITY_THRESHOLD} Jaccard keyword overlap.`,
      });
      continue;
    }

    const sortedSlugs = [...slugs].sort();
    const members = sortedSlugs.map((slug) => {
      const p = blogPosts.find((x) => x.slug === slug)!;
      return { slug: p.slug, title: p.title };
    });

    // Compute the shared-keyword set across the whole group (intersection
    // of all member keyword sets — strictest honest definition).
    let intersection: Set<string> | null = null;
    for (const slug of sortedSlugs) {
      const p = blogPosts.find((x) => x.slug === slug)!;
      const ks = normaliseKeywords(p);
      if (intersection === null) {
        intersection = new Set(ks);
      } else {
        for (const k of intersection) {
          if (!ks.has(k)) intersection.delete(k);
        }
      }
    }
    const sharedKeywords = Array.from(intersection ?? []);

    groups.push({
      id: sortedSlugs.join("|"),
      members,
      sharedKeywords,
      derivation: `Joined via pairwise Jaccard ≥ ${SIMILARITY_THRESHOLD} on the keywords[] field.`,
    });
  }

  const globalDiagnostics: Diagnostic[] = [];
  if (blogPosts.length > 1 && groups.length === 0) {
    globalDiagnostics.push({
      severity: "info",
      message: "No topic groups formed.",
      derivation: `Pairwise Jaccard across ${blogPosts.length} posts produced no overlap ≥ ${SIMILARITY_THRESHOLD}.`,
      hint: "Add overlapping keywords to thematically-related posts so they join a cluster.",
    });
  }

  return { pairs, groups, isolatedPosts, globalDiagnostics };
}
