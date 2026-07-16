// ContentOps visibility-gap consumer + enforce-edit guard — Phase 3 unit tests. Pure logic over synthetic
// fixtures (no Supabase, no live API). Run: `npm run test:contentops-visibility`.
//
// Covers the required cases: only streak ≥ N reaches the consumer (a streak-2 is dropped); provenance survives
// the Zod schema onto the draft (the Zod-strip issue makes this the test that matters most); the enforce-edit
// guard blocks a byte-for-byte-unchanged draft and allows an edited one; existing gates are untouched.

import assert from "node:assert/strict";
import { test } from "node:test";

import { blogPostSchema, type BlogPost } from "@/lib/contentops/blog-schema";
import { isEditorialContentUnchanged, editorialFingerprint } from "@/lib/contentops/editorial-fingerprint";
import { parseTopicProvenance, VISIBILITY_GAP_SOURCE } from "@/lib/contentops/topic-provenance";
import {
  MIN_GAP_STREAK,
  parseVisibilityGaps,
  readVisibilityGaps,
} from "@/lib/contentops/visibility-gaps";
import { visibilityGapOpportunities } from "@/lib/contentops/topic-suggestions";

const NOW = new Date("2026-09-10T00:00:00Z").getTime();
const feed = (over: Record<string, unknown> = {}) => ({
  schema: "operatorhq.visibility-gaps.v1",
  niche: "littlesmiles",
  generatedAt: "2026-09-09T00:00:00Z",
  minStreak: 3,
  gaps: [
    { query: "how do I wash a baby swaddle", streak: 4, competitors: ["Baby Planet", "Mothercare"] },
    { query: "best food bag for baby outings", streak: 3, competitors: ["Snug N' Play"] },
    { query: "streak-2 noise query", streak: 2, competitors: ["X"] }, // below N — must be dropped
  ],
  ...over,
});

// ── only streak ≥ N reaches the consumer ─────────────────────────────────────
test("parseVisibilityGaps drops sub-threshold (streak < N) gaps", () => {
  const gaps = parseVisibilityGaps(feed(), NOW);
  assert.deepEqual(gaps.map((g) => g.query), ["how do I wash a baby swaddle", "best food bag for baby outings"]);
  assert.ok(gaps.every((g) => g.streak >= MIN_GAP_STREAK));
});

test("parseVisibilityGaps fails closed on wrong schema / stale / bad payload", () => {
  assert.deepEqual(parseVisibilityGaps(feed({ schema: "nope" }), NOW), []);
  assert.deepEqual(parseVisibilityGaps(feed({ generatedAt: "2026-01-01T00:00:00Z" }), NOW), []); // >6wk stale
  assert.deepEqual(parseVisibilityGaps(feed({ generatedAt: "not-a-date" }), NOW), []);
  assert.deepEqual(parseVisibilityGaps(feed({ gaps: "nope" }), NOW), []);
  assert.deepEqual(parseVisibilityGaps(null, NOW), []);
});

test("readVisibilityGaps: absent file / bad JSON → [] (panel behaves as before)", () => {
  assert.deepEqual(readVisibilityGaps({ exists: () => false }), []);
  assert.deepEqual(readVisibilityGaps({ exists: () => true, read: () => "{bad json" }), []);
  const ok = readVisibilityGaps({ exists: () => true, read: () => JSON.stringify(feed()), nowMs: NOW });
  assert.equal(ok.length, 2);
});

test("visibilityGapOpportunities carries source + provenance (streak + competitors) for the reviewer", () => {
  const opps = visibilityGapOpportunities({ exists: () => true, read: () => JSON.stringify(feed()), nowMs: NOW });
  assert.equal(opps.length, 2);
  assert.equal(opps[0].source, VISIBILITY_GAP_SOURCE);
  assert.equal(opps[0].priority, "high");
  assert.equal(opps[0].provenance?.visibilityStreak, 4);
  assert.deepEqual(opps[0].provenance?.competitorsCited, ["Baby Planet", "Mothercare"]);
});

// ── provenance survives the Zod schema onto the draft (the critical test) ────
const baseContent: BlogPost = {
  slug: "wash-a-baby-swaddle",
  title: "How to Wash a Baby Swaddle",
  description: "A simple, safe routine for washing and caring for baby swaddles.",
  category: "Newborn Care",
  relatedProductCategory: "Swaddle",
  publishedAt: "2026-09-10",
  readTime: "4 min read",
  keywords: ["wash baby swaddle", "swaddle care"],
  sections: [{ heading: "Start gentle", content: ["Use a mild detergent."] }],
  cta: { label: "Shop swaddles", href: "/shop?category=Swaddle" },
};

test("provenance SURVIVES blogPostSchema.parse (not stripped as an unknown key)", () => {
  const withProvenance = {
    ...baseContent,
    provenance: { source: VISIBILITY_GAP_SOURCE, visibilityStreak: 4, competitorsCited: ["Baby Planet"], generatedAt: "2026-09-09T00:00:00Z" },
  };
  const parsed = blogPostSchema.parse(withProvenance);
  assert.ok(parsed.provenance, "provenance must survive the schema parse");
  assert.equal(parsed.provenance?.source, VISIBILITY_GAP_SOURCE);
  assert.equal(parsed.provenance?.visibilityStreak, 4);
});

test("a post WITHOUT provenance still validates (additive + optional)", () => {
  const parsed = blogPostSchema.parse(baseContent);
  assert.equal(parsed.provenance, undefined);
});

test("parseTopicProvenance validates request payloads fail-safe", () => {
  assert.ok(parseTopicProvenance({ source: VISIBILITY_GAP_SOURCE, visibilityStreak: 3, competitorsCited: [] }));
  assert.equal(parseTopicProvenance({ source: "nope" }), null);
  assert.equal(parseTopicProvenance(null), null);
});

// ── enforce-edit guard ────────────────────────────────────────────────────────
test("enforce-edit: byte-for-byte-unchanged draft is flagged unchanged; an edited one is not", () => {
  const original = { ...baseContent };
  assert.equal(isEditorialContentUnchanged({ ...baseContent }, original), true); // reviewer changed nothing
  const edited = { ...baseContent, title: "How to Wash a Baby Swaddle (2026 Guide)" };
  assert.equal(isEditorialContentUnchanged(edited, original), false); // a real edit
});

test("enforce-edit: null original → allowed (legacy drafts never blocked)", () => {
  assert.equal(isEditorialContentUnchanged(baseContent, null), false);
});

test("enforce-edit: auto-managed fields (publishedAt/readTime/heroImage/provenance) are NOT edits", () => {
  const original = { ...baseContent };
  const autostamped = {
    ...baseContent,
    publishedAt: "2026-09-11",
    readTime: "5 min read",
    heroImage: "/products/x.jpg",
    provenance: { source: VISIBILITY_GAP_SOURCE, visibilityStreak: 4, competitorsCited: [] },
  };
  // fingerprints match → still "unchanged" (auto-stamps can't bypass the guard by faking an edit)
  assert.equal(editorialFingerprint(autostamped as BlogPost), editorialFingerprint(original));
  assert.equal(isEditorialContentUnchanged(autostamped as BlogPost, original), true);
});
