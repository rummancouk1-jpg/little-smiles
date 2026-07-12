// Metadata-repair pass (Haiku tier) — the "metadata → review queue" step the
// architecture doc describes but was never built. It repairs the AUTO-FILLABLE
// metadata fields (SEO title length, meta description length, keyword count,
// slug shape) so a draft doesn't reach the reviewer failing a mechanical band
// check. It is deliberately NARROW: it never touches the article body, never
// invents store facts, and never judges quality — full-length/FAQ expansion is
// a separate, larger pass (Branch 2). This module is SDK-free (bands + prompt
// builders + a parser + deterministic helpers) so callers and tests can import
// it without the Anthropic client; the actual Haiku call lives in
// draft-generation.ts, mirroring the critique-pass split.

import { type BlogPost } from "@/lib/contentops/blog-schema";

// Bands mirror draft-validation.ts / publish-score.ts exactly — a field this
// pass repairs must land green there too.
export const METADATA_BANDS = {
  titleMin: 30,
  titleMax: 70,
  descriptionMin: 80,
  descriptionMax: 160,
  keywordsMin: 3,
} as const;

// Haiku 4.5 — mechanical field repair, the tier the architecture doc intended.
export const METADATA_REPAIR_MODEL = "claude-haiku-4-5-20251001";

export type MetadataAssessment = {
  titleOk: boolean;
  descriptionOk: boolean;
  keywordsOk: boolean;
  slugOk: boolean;
  /** True when nothing needs repairing (the pass can be skipped entirely). */
  allOk: boolean;
  /** Human-readable list of what's out of band (for prompts / logs). */
  issues: string[];
};

/** Deterministic, LLM-free slug shape: lowercase, hyphen-separated, no run-on
 *  or edge hyphens. The pass owns "slug valid" without a model call. */
export function normalizeSlug(slug: string): string {
  return slug
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

/** Which auto-fillable metadata fields are out of band. Pure. */
export function assessMetadata(post: BlogPost): MetadataAssessment {
  const titleLen = post.title.length;
  const descLen = post.description.length;
  const titleOk = titleLen >= METADATA_BANDS.titleMin && titleLen <= METADATA_BANDS.titleMax;
  const descriptionOk = descLen >= METADATA_BANDS.descriptionMin && descLen <= METADATA_BANDS.descriptionMax;
  const keywordsOk = post.keywords.length >= METADATA_BANDS.keywordsMin;
  const slugOk = post.slug === normalizeSlug(post.slug) && post.slug.length > 0;

  const issues: string[] = [];
  if (!titleOk) issues.push(`title ${titleLen} chars (target ${METADATA_BANDS.titleMin}-${METADATA_BANDS.titleMax})`);
  if (!descriptionOk) issues.push(`description ${descLen} chars (target ${METADATA_BANDS.descriptionMin}-${METADATA_BANDS.descriptionMax})`);
  if (!keywordsOk) issues.push(`${post.keywords.length} keyword(s) (target ≥ ${METADATA_BANDS.keywordsMin})`);
  if (!slugOk) issues.push(`slug "${post.slug}" is not a clean lowercase-hyphen slug`);

  return {
    titleOk,
    descriptionOk,
    keywordsOk,
    slugOk,
    allOk: titleOk && descriptionOk && keywordsOk && slugOk,
    issues,
  };
}

/** The forced tool the model calls to return repaired fields. */
export const METADATA_REPAIR_TOOL_NAME = "submit_repaired_metadata";
export const metadataRepairToolInputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: {
      type: "string",
      description: `SEO title, ${METADATA_BANDS.titleMin}-${METADATA_BANDS.titleMax} characters, primary keyword near the front. Keep the meaning; trim any padding / post-colon subtitle to fit.`,
    },
    description: {
      type: "string",
      description: `Meta description, ${METADATA_BANDS.descriptionMin}-${METADATA_BANDS.descriptionMax} characters, one clear value prop, primary keyword included.`,
    },
    keywords: {
      type: "array",
      items: { type: "string" },
      description: `At least ${METADATA_BANDS.keywordsMin} specific, search-like keyword phrases drawn from the article, most important first.`,
    },
  },
  required: ["title", "description", "keywords"],
} as const;

export function buildMetadataRepairSystem(): string {
  return [
    "You repair the SEO METADATA of an already-written blog draft for Little Smiles, a premium boutique baby brand in Pakistan.",
    "Your ONLY job is to make the title, meta description, and keywords fit strict length bands while preserving the article's meaning, language, and voice.",
    "Do NOT rewrite or summarize the article body. Do NOT invent product facts, sizes, certifications, or promises. Do NOT change the topic.",
    `Bands: title ${METADATA_BANDS.titleMin}-${METADATA_BANDS.titleMax} chars; description ${METADATA_BANDS.descriptionMin}-${METADATA_BANDS.descriptionMax} chars; at least ${METADATA_BANDS.keywordsMin} keywords.`,
    "When a field is already within its band, return it essentially unchanged. Call the submit_repaired_metadata tool exactly once.",
  ].join("\n");
}

export function buildMetadataRepairUser(post: BlogPost, assessment: MetadataAssessment): string {
  // Give the model the body as read-only context so the description/keywords
  // stay grounded in what the article actually says.
  const body = post.sections
    .map((s) => `## ${s.heading}\n${s.content.join("\n")}`)
    .join("\n\n")
    .slice(0, 6000);
  return [
    `Fields to bring within band: ${assessment.issues.join("; ") || "(all already in band — return as-is)"}`,
    "",
    `Current title (${post.title.length} chars): ${post.title}`,
    `Current description (${post.description.length} chars): ${post.description}`,
    `Current keywords (${post.keywords.length}): ${post.keywords.join(", ")}`,
    "",
    "ARTICLE BODY (read-only context — do not edit, summarize, or return it):",
    body,
  ].join("\n");
}

/** Hard length backstop for the MAX side (too-long title/description) so the
 *  pass still lands in band even if the model overshoots. Truncates on a word
 *  boundary. The MIN side (too-short) can't be padded deterministically and is
 *  left to the model. */
function clampMax(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:–-]+$/, "");
}

/**
 * Merge the model's repaired values into the post — but ONLY for fields that
 * were out of band (never churn a good field), and always normalize the slug
 * deterministically. Applies the MAX-side backstop. Pure.
 */
export function applyRepairedMetadata(
  post: BlogPost,
  assessment: MetadataAssessment,
  repaired: { title?: string; description?: string; keywords?: string[] },
): BlogPost {
  const next: BlogPost = { ...post };

  // Title / description: use the model's value when it gave one, else the
  // original, then always apply the MAX-side clamp so a too-LONG field lands in
  // band deterministically even if the model call was skipped or failed. (A
  // too-SHORT field can only be fixed by the model — the clamp is a no-op there.)
  if (!assessment.titleOk) {
    const candidate = typeof repaired.title === "string" && repaired.title.trim() ? repaired.title.trim() : post.title;
    next.title = clampMax(candidate, METADATA_BANDS.titleMax);
  }
  if (!assessment.descriptionOk) {
    const candidate =
      typeof repaired.description === "string" && repaired.description.trim() ? repaired.description.trim() : post.description;
    next.description = clampMax(candidate, METADATA_BANDS.descriptionMax);
  }
  if (!assessment.keywordsOk && Array.isArray(repaired.keywords)) {
    const cleaned = repaired.keywords
      .filter((k): k is string => typeof k === "string" && k.trim().length > 0)
      .map((k) => k.trim());
    if (cleaned.length >= METADATA_BANDS.keywordsMin) next.keywords = cleaned.slice(0, 12);
  }
  if (!assessment.slugOk) {
    next.slug = normalizeSlug(post.slug);
  }

  return next;
}

/** Parse the model tool input into the repaired-field shape (sanitized). */
export function parseRepairedMetadata(rawInput: unknown): {
  title?: string;
  description?: string;
  keywords?: string[];
} {
  const raw = (rawInput ?? {}) as Record<string, unknown>;
  const out: { title?: string; description?: string; keywords?: string[] } = {};
  if (typeof raw.title === "string") out.title = raw.title;
  if (typeof raw.description === "string") out.description = raw.description;
  if (Array.isArray(raw.keywords)) {
    out.keywords = raw.keywords.filter((k): k is string => typeof k === "string");
  }
  return out;
}
