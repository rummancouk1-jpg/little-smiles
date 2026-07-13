// Full-length expansion pass (Sonnet 5, high effort) — the substantive-content
// step that brings a THIN draft up to the real quality bar before it can reach
// the operator queue. Unlike the Haiku metadata-repair (mechanical field fixes),
// this rewrites/deepens the BODY: more developed sections, more words, real FAQ.
//
// SDK-free (targets + gap assessment + prompt builders + a schema-valid parser);
// the actual Sonnet 5 call + the bounded retry loop live in draft-generation.ts,
// mirroring the critique / metadata-repair split.

import Anthropic from "@anthropic-ai/sdk";

import { blogPostSchema, type BlogPost } from "@/lib/contentops/blog-schema";
import { IMPROVEMENT_TARGETS } from "@/lib/contentops/improvement";

// Sonnet 5 — substantive content writing (the prose that determines ranking).
export const EXPANSION_MODEL = "claude-sonnet-5";
// Bounded: at most this many expansion attempts, then we stop (never an
// open-ended expand→rescore loop). Re-scoring between attempts is deterministic.
export const MAX_EXPANSION_ATTEMPTS = 2;

/** Word count for a BlogPost body (sections only, matching draft-validation). */
export function countBodyWords(post: BlogPost): number {
  return post.sections.reduce(
    (sum, s) => sum + s.content.reduce((n, p) => n + p.trim().split(/\s+/).filter(Boolean).length, 0),
    0,
  );
}

export type LengthGapAssessment = {
  /** True when the draft is below the full quality bar (thin / too few sections / too little FAQ). */
  belowBar: boolean;
  wordCount: number;
  sectionCount: number;
  faqCount: number;
  /** Human-readable gap lines (e.g. "388 words (target ≥ 700)"). */
  gaps: string[];
};

/** Assess a BlogPost against the FULL quality bar (length / sections / FAQ) —
 *  the same thresholds the improvement engine + queue honesty flag use. Pure. */
export function assessLengthGaps(post: BlogPost): LengthGapAssessment {
  const wordCount = countBodyWords(post);
  const sectionCount = post.sections.length;
  const faqCount = post.faq?.length ?? 0;
  const gaps: string[] = [];
  if (wordCount < IMPROVEMENT_TARGETS.wordCountMin) gaps.push(`${wordCount} words (target ≥ ${IMPROVEMENT_TARGETS.wordCountMin})`);
  if (sectionCount < IMPROVEMENT_TARGETS.sectionCountMin) gaps.push(`${sectionCount} sections (target ≥ ${IMPROVEMENT_TARGETS.sectionCountMin})`);
  if (faqCount < IMPROVEMENT_TARGETS.faqMin) gaps.push(`${faqCount} FAQ (target ≥ ${IMPROVEMENT_TARGETS.faqMin})`);
  return { belowBar: gaps.length > 0, wordCount, sectionCount, faqCount, gaps };
}

export const EXPANSION_TOOL_NAME = "submit_blog_post";

export function buildExpansionSystem(
  catalogBrief: string,
  pakistanBrief: string,
  safetyBrief: string,
  businessPolicyBrief: string,
): string {
  return [
    "You EXPAND an existing SEO blog draft for Little Smiles, a premium boutique baby brand based in Pakistan, to full publishable length — WITHOUT changing its topic, slug, category, relatedProductCategory, voice, or CTA.",
    "Audience: parents (primarily mothers) of newborns to 2-year-olds, browsing in English on mobile. Voice: calm, editorial, practical — not pushy, not generic, not hype.",
    `LENGTH: bring the body to ${IMPROVEMENT_TARGETS.wordCountMin}-${IMPROVEMENT_TARGETS.wordCountMax} words across ${IMPROVEMENT_TARGETS.sectionCountMin}-${IMPROVEMENT_TARGETS.sectionCountMax} sections. Deepen the existing sections and add new ones where the topic genuinely warrants it — concrete detail (examples, comparisons, Pakistan specifics, care/usage guidance), never padding to hit a number.`,
    "PRESERVE the good content already written — this is a deepening pass, not a restart. Keep the existing title, slug, category, relatedProductCategory, and CTA unless they are clearly broken.",
    `FAQ IS REQUIRED: ensure ${IMPROVEMENT_TARGETS.faqMin}-${IMPROVEMENT_TARGETS.faqMax} real pre-purchase FAQ entries, each a genuine parent question with a short, direct answer.`,
    "INTERNAL LINKS: keep the existing valid links and weave at least 1-2 markdown links into body paragraphs, choosing ONLY from the VALID LINK TARGETS listed in the user message. Never invent a product or blog slug. Place each link where it reads naturally in a sentence — not forced mid-analogy or jammed into a list.",
    "Do not invent store facts the catalog below doesn't support (sizes, certifications, materials, delivery/discount promises).",
    "Output exactly one call to the submit_blog_post tool with the COMPLETE expanded post. Do not include text outside the tool call.",
    "",
    catalogBrief,
    "",
    pakistanBrief,
    "",
    safetyBrief,
    "",
    businessPolicyBrief,
  ].join("\n");
}

export function buildExpansionUser(post: BlogPost, gaps: string[], linkTargetsMenu: string): string {
  return [
    `Gaps to close (the draft is currently below the quality bar): ${gaps.join("; ")}.`,
    "",
    linkTargetsMenu,
    "",
    "CURRENT DRAFT (expand this — keep its topic, voice, slug, category, and CTA):",
    "",
    JSON.stringify(post, null, 2),
  ].join("\n");
}

/** Parse the model's tool output into a schema-valid BlogPost, or null on
 *  failure (caller keeps the pre-expansion draft). heroImage is a reviewer-only
 *  field and is stripped, exactly as in the initial-draft path. */
export function parseExpandedPost(rawInput: unknown): BlogPost | null {
  const parsed = blogPostSchema.safeParse(rawInput);
  if (!parsed.success) return null;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { heroImage: _hero, ...post } = parsed.data;
  return post;
}

export type ExpansionToolSchema = Anthropic.Messages.Tool["input_schema"];
