/**
 * ContentOps draft generation — the single source of truth for turning a
 * topic string into a validated, critiqued, persisted `pending_review` draft.
 *
 * Both callers share THIS implementation — there is no second copy:
 *   - the CLI (`scripts/contentops-draft.ts`) for local/terminal runs
 *   - the admin API route (`/api/admin/contentops/drafts/generate`) for the UI
 *
 * The full pipeline fires exactly once here: duplicate-intent guard →
 * raised-floor drafting prompt → Zod validation → link validation/cleanup →
 * slug-availability check → Opus critique pass → insert with critique flags.
 *
 * This module is environment-agnostic: it never calls `process.exit`, never
 * reads `process.argv`, and never assumes a TTY. Failures surface as typed
 * `DraftGenerationError`s the caller maps to an exit code (CLI) or an HTTP
 * status (route). Progress is reported through an optional `onProgress` hook.
 */
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { blogPosts } from "../blog";
import { getAllBlogPosts } from "../blog-data";
import { getSupabaseAdminClient } from "../supabase-admin";
import { buildCatalogBrief } from "./catalog-brief";
import { blogPostSchema, type BlogPost } from "./blog-schema";
import {
  buildCorpusBrief,
  findTopicOverlap,
  DUPLICATE_INTENT_THRESHOLD,
  DUPLICATE_INTENT_WARN,
  type CorpusEntry,
} from "./corpus-brief";
import {
  CRITIQUE_MODEL,
  CRITIQUE_TOOL_NAME,
  buildCritiqueSystem,
  buildCritiqueUser,
  critiqueToolInputSchema,
  toCritiqueResult,
  type CritiqueResult,
} from "./critique";
import { listDrafts } from "./drafts-store";
import {
  buildLinkTargetsMenu,
  validateAndCleanLinks,
  type LinkTargets,
} from "./link-validation";
import { PAKISTAN_BRIEF } from "./pakistan-brief";
import { SAFETY_BRIEF } from "./safety";
import { chooseTemplate } from "./template";
import { products } from "../products";

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 4000;
const TIMEOUT_MS = 60_000;
const TOOL_NAME = "submit_blog_post";

export const TOPIC_MIN_LENGTH = 5;
export const TOPIC_MAX_LENGTH = 200;

/**
 * Stable, machine-readable failure codes so the CLI and the route can map a
 * failure to an exit code / HTTP status without string-matching messages.
 */
export type DraftGenerationErrorCode =
  | "invalid_topic"
  | "config"
  | "duplicate_intent"
  | "model_no_tool_use"
  | "schema_validation"
  | "slug_conflict"
  | "db"
  | "anthropic";

export class DraftGenerationError extends Error {
  readonly code: DraftGenerationErrorCode;
  /** Extra structured context for the caller (e.g. the overlapping post). */
  readonly details?: Record<string, unknown>;

  constructor(code: DraftGenerationErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "DraftGenerationError";
    this.code = code;
    this.details = details;
  }
}

export type GenerateDraftOptions = {
  /** Anthropic API key. Defaults to `process.env.ANTHROPIC_API_KEY`. */
  anthropicKey?: string;
  /** Best-effort progress callback (CLI prints these; the route ignores them). */
  onProgress?: (message: string) => void;
};

export type GenerateDraftResult = {
  id: string;
  slug: string;
  draft: BlogPost;
  critique: CritiqueResult | null;
  validLinkCount: number;
  strippedLinks: { anchor: string; href: string }[];
  /** Non-fatal advisories the reviewer should see (near-duplicate, no links). */
  warnings: string[];
};

type AdminClient = NonNullable<ReturnType<typeof getSupabaseAdminClient>>;

function normalizeTopic(raw: string): string {
  const topic = raw.trim();
  if (!topic) {
    throw new DraftGenerationError("invalid_topic", "A topic is required.");
  }
  if (topic.length < TOPIC_MIN_LENGTH || topic.length > TOPIC_MAX_LENGTH) {
    throw new DraftGenerationError(
      "invalid_topic",
      `Topic must be ${TOPIC_MIN_LENGTH}-${TOPIC_MAX_LENGTH} characters (got ${topic.length}).`,
    );
  }
  return topic;
}

function requireAnthropicKey(explicit?: string): string {
  const key = (explicit ?? process.env.ANTHROPIC_API_KEY)?.trim();
  if (!key) {
    throw new DraftGenerationError(
      "config",
      "ANTHROPIC_API_KEY is not configured on the server.",
    );
  }
  return key;
}

function requireAdminClient(): AdminClient {
  const client = getSupabaseAdminClient();
  if (!client) {
    throw new DraftGenerationError(
      "config",
      "Supabase admin client is not configured (check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY).",
    );
  }
  return client;
}

/**
 * The live corpus the model must not duplicate and may link to: static +
 * DB-published posts, plus in-flight pending/approved drafts (so we don't
 * generate a near-copy of something already in the queue).
 */
async function loadCorpus(): Promise<CorpusEntry[]> {
  const live = await getAllBlogPosts();
  const [pending, approved] = await Promise.all([
    listDrafts("pending_review"),
    listDrafts("approved"),
  ]);
  const entries = new Map<string, CorpusEntry>();
  for (const p of live) {
    entries.set(p.slug, { slug: p.slug, title: p.title, keywords: p.keywords });
  }
  for (const d of [...pending, ...approved]) {
    if (!entries.has(d.slug)) {
      entries.set(d.slug, {
        slug: d.slug,
        title: d.content.title,
        keywords: d.content.keywords,
      });
    }
  }
  return [...entries.values()];
}

function buildPrompt(topic: string, corpus: CorpusEntry[]) {
  const example = blogPosts[0];
  const exampleJson = JSON.stringify(example, null, 2);
  const template = chooseTemplate(topic);

  const categories = [...new Set(products.map((p) => p.category))];
  const blogSlugs = corpus.map((c) => c.slug);

  const system = [
    "You write SEO blog drafts for Little Smiles, a premium boutique baby brand based in Pakistan.",
    "Audience: parents (primarily mothers) of newborns to 2-year-olds, browsing in English on mobile.",
    "Voice: calm, editorial, practical. Not pushy. Not generic. Not full of hype.",
    "Answer one parent question deeply, with 2-4 line paragraphs and a single relevant CTA to a shop category. Follow the STRUCTURE guidance below for section and FAQ shape — do not force a fixed skeleton across posts.",
    "LENGTH: aim for 600-800 words of genuine, developed body content (excluding FAQ). Each section must earn its place with concrete detail — examples, comparisons, local specifics — never padding to reach a number. A thin 300-word draft is a failure.",
    "FAQ IS REQUIRED: include 3-5 faq entries every time, each a real pre-purchase question with a short, direct answer. A draft with zero FAQ is incomplete.",
    "INTERNAL LINKS ARE REQUIRED: weave at least 1-2 links into body paragraphs using markdown, choosing ONLY from the VALID LINK TARGETS listed in the user message. Never invent a product slug or a blog slug — a link to anything not on that list is stripped before publish.",
    "Output exactly one call to the submit_blog_post tool. Do not include text outside the tool call.",
    "",
    buildCatalogBrief(),
    "",
    PAKISTAN_BRIEF,
    "",
    SAFETY_BRIEF,
  ].join("\n");

  const user = [
    `Topic: ${topic}`,
    "",
    template.guidance,
    "",
    buildLinkTargetsMenu(categories, blogSlugs),
    "",
    buildCorpusBrief(corpus),
    "",
    "Match the VOICE and CTA pattern (not the section skeleton) of this existing post:",
    "",
    exampleJson,
    "",
    "Now write a new post on the topic above. Use a fresh slug (lowercase, hyphen-separated, unique).",
    "Pick the most relevant `category` and `relatedProductCategory` from the schema's allowed values.",
    "Do not copy the example's wording or reuse its section headings.",
  ].join("\n");

  return { system, user };
}

async function generateBlogPost(
  anthropic: Anthropic,
  topic: string,
  corpus: CorpusEntry[],
): Promise<BlogPost> {
  const { system, user } = buildPrompt(topic, corpus);
  const inputSchema = z.toJSONSchema(blogPostSchema) as Record<string, unknown>;

  let response: Anthropic.Messages.Message;
  try {
    response = await anthropic.messages.create(
      {
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system,
        tools: [
          {
            name: TOOL_NAME,
            description: "Submit one complete blog post object.",
            input_schema: inputSchema as Anthropic.Messages.Tool["input_schema"],
          },
        ],
        tool_choice: { type: "tool", name: TOOL_NAME },
        messages: [{ role: "user", content: user }],
      },
      { timeout: TIMEOUT_MS },
    );
  } catch (err) {
    throw new DraftGenerationError(
      "anthropic",
      `Anthropic request failed: ${err instanceof Error ? err.message : "unknown error"}`,
    );
  }

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new DraftGenerationError(
      "model_no_tool_use",
      `Model did not return a draft (stop_reason=${response.stop_reason}). Try a different topic or check API status.`,
    );
  }

  const parsed = blogPostSchema.safeParse(toolUse.input);
  if (!parsed.success) {
    throw new DraftGenerationError(
      "schema_validation",
      "Generated draft failed schema validation. No draft was saved.",
      { issues: parsed.error.flatten() },
    );
  }
  // heroImage is a REVIEWER-only field (set via the hero-image picker →
  // the hero_image_path column), never authored by the model. Strip it so
  // the model can't fabricate an image URL (it invents dead external URLs);
  // the reviewer chooses a real /public asset in the admin.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { heroImage: _modelHeroImage, ...draft } = parsed.data;
  return draft;
}

/**
 * Opus critique pass (Sonnet drafts, Opus critiques — the audit's own
 * recommendation). Reads the draft against the catalog + safety rules +
 * corpus and returns flagged issues for the human reviewer. Best-effort:
 * a critique failure never blocks the draft (it just ships without flags).
 * Thinking is left off so the forced tool_choice is reliably accepted,
 * mirroring the drafting call that already works in this repo.
 */
async function runCritique(
  anthropic: Anthropic,
  draft: BlogPost,
  corpus: CorpusEntry[],
  onProgress?: (message: string) => void,
): Promise<CritiqueResult | null> {
  try {
    const response = await anthropic.messages.create(
      {
        model: CRITIQUE_MODEL,
        max_tokens: MAX_TOKENS,
        system: buildCritiqueSystem(buildCatalogBrief(), SAFETY_BRIEF),
        tools: [
          {
            name: CRITIQUE_TOOL_NAME,
            description: "Report the flagged issues for the human reviewer.",
            input_schema:
              critiqueToolInputSchema as unknown as Anthropic.Messages.Tool["input_schema"],
          },
        ],
        tool_choice: { type: "tool", name: CRITIQUE_TOOL_NAME },
        messages: [{ role: "user", content: buildCritiqueUser(draft, buildCorpusBrief(corpus)) }],
      },
      { timeout: TIMEOUT_MS },
    );
    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") return null;
    return toCritiqueResult(toolUse.input, CRITIQUE_MODEL);
  } catch (err) {
    onProgress?.(
      `Critique pass skipped (${err instanceof Error ? err.message : "error"}).`,
    );
    return null;
  }
}

async function checkSlugAvailable(client: AdminClient, slug: string) {
  const { data, error } = await client
    .from("contentops_drafts")
    .select("id, status")
    .eq("slug", slug)
    .in("status", ["pending_review", "approved"])
    .limit(1);
  if (error) {
    throw new DraftGenerationError("db", `Slug-availability check failed: ${error.message}`);
  }
  const existing = data?.[0];
  if (existing) {
    throw new DraftGenerationError(
      "slug_conflict",
      `A "${slug}" draft is already in the queue (status=${existing.status}). ` +
        "Reject or publish it before regenerating.",
      { slug, existingId: existing.id, existingStatus: existing.status },
    );
  }
}

async function insertDraft(
  client: AdminClient,
  draft: BlogPost,
  critique: CritiqueResult | null,
  onProgress?: (message: string) => void,
) {
  const baseRow = {
    slug: draft.slug,
    status: "pending_review" as const,
    content: draft,
    hero_image_path: null,
    rejection_note: null,
    approved_at: null,
    published_at: null,
  };
  // Try WITH critique; if the column hasn't been migrated yet (PGRST204),
  // fall back to inserting without it — mirrors the order-intent pattern.
  let { data, error } = await client
    .from("contentops_drafts")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert({ ...baseRow, critique } as any)
    .select("id, slug")
    .single();
  // PostgREST reports a missing column with code PGRST204 (schema-cache miss).
  const columnMissing =
    error?.code === "PGRST204" || /critique.*column|schema cache/i.test(error?.message ?? "");
  if (error && columnMissing) {
    onProgress?.(
      "'critique' column not found — apply supabase/contentops-schema.sql to store critiques. Inserting without it.",
    );
    ({ data, error } = await client
      .from("contentops_drafts")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert(baseRow as any)
      .select("id, slug")
      .single());
  }
  if (error || !data) {
    throw new DraftGenerationError(
      "db",
      `Saving the draft failed: ${error?.message ?? "unknown error"}`,
    );
  }
  return data;
}

/**
 * Generate one blog draft for `topic` and persist it as `pending_review`.
 *
 * Runs the complete pipeline and returns the inserted draft's id/slug plus
 * the critique, link stats, and any non-fatal warnings. Throws a typed
 * `DraftGenerationError` on any hard failure (invalid topic, duplicate
 * intent, model/DB errors) — never auto-publishes, never exits the process.
 */
export async function generateDraftForTopic(
  rawTopic: string,
  options: GenerateDraftOptions = {},
): Promise<GenerateDraftResult> {
  const { onProgress } = options;
  const topic = normalizeTopic(rawTopic);
  const anthropicKey = requireAnthropicKey(options.anthropicKey);
  const client = requireAdminClient();
  const anthropic = new Anthropic({ apiKey: anthropicKey });

  const warnings: string[] = [];

  // Duplicate-intent guard — refuse before spending tokens when the topic
  // substantially overlaps something we already cover (or have queued).
  const corpus = await loadCorpus();
  const overlaps = findTopicOverlap(topic, corpus);
  const worst = overlaps[0];
  if (worst && worst.score >= DUPLICATE_INTENT_THRESHOLD) {
    throw new DraftGenerationError(
      "duplicate_intent",
      `Topic overlaps an existing post (${Math.round(worst.score * 100)}% intent match): ` +
        `"${worst.title}" (/blog/${worst.slug}). ` +
        "Refresh that post instead of splitting its ranking signal, or pick a more specific angle.",
      { slug: worst.slug, title: worst.title, score: worst.score },
    );
  }
  if (worst && worst.score >= DUPLICATE_INTENT_WARN) {
    warnings.push(
      `Closest existing post is "${worst.title}" (${Math.round(worst.score * 100)}% overlap) — keep this angle distinct.`,
    );
  }

  onProgress?.(`Generating draft for: "${topic}"`);
  const rawDraft = await generateBlogPost(anthropic, topic, corpus);

  // Link-validation backstop — strip any internal link that doesn't resolve
  // to a real category / product / existing post, so a fabricated URL can
  // never ship (the prompt gives the valid menu; this enforces it).
  const targets: LinkTargets = {
    categories: new Set(products.map((p) => p.category)),
    blogSlugs: new Set(corpus.map((c) => c.slug)),
    productSlugs: new Set(products.map((p) => p.slug)),
  };
  const { draft, strippedLinks, validLinkCount } = validateAndCleanLinks(rawDraft, targets);
  if (strippedLinks.length > 0) {
    onProgress?.(
      `Stripped ${strippedLinks.length} invalid link(s): ` +
        strippedLinks.map((l) => l.href).join(", "),
    );
  }
  if (validLinkCount === 0) {
    warnings.push("Draft has NO valid internal links — add one before publishing.");
  }

  await checkSlugAvailable(client, draft.slug);

  onProgress?.("Running Opus critique pass...");
  const critique = await runCritique(anthropic, draft, corpus, onProgress);
  if (critique) {
    onProgress?.(`Critique: ${critique.flags.length} flag(s).`);
  }

  const inserted = await insertDraft(client, draft, critique, onProgress);

  return {
    id: inserted.id,
    slug: inserted.slug,
    draft,
    critique,
    validLinkCount,
    strippedLinks,
    warnings,
  };
}
