/**
 * ContentOps draft CLI — local-only.
 *
 * Generates a single blog draft via Anthropic, validates against the Zod
 * BlogPost schema, and persists it to `contentops_drafts` with status
 * `pending_review`. Never auto-publishes; the reviewer approves every draft.
 *
 * Usage:
 *   npm run contentops:draft -- "<topic>"
 *
 * Required env:
 *   ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Prerequisite: supabase/contentops-schema.sql must already be applied to the
 * target Supabase database. The script verifies connectivity before spending
 * any Anthropic tokens.
 */
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { blogPosts } from "../lib/blog";
import { getAllBlogPosts } from "../lib/blog-data";
import { buildCatalogBrief } from "../lib/contentops/catalog-brief";
import {
  buildCorpusBrief,
  findTopicOverlap,
  DUPLICATE_INTENT_THRESHOLD,
  DUPLICATE_INTENT_WARN,
  type CorpusEntry,
} from "../lib/contentops/corpus-brief";
import { blogPostSchema, type BlogPost } from "../lib/contentops/blog-schema";
import {
  CRITIQUE_MODEL,
  CRITIQUE_TOOL_NAME,
  buildCritiqueSystem,
  buildCritiqueUser,
  critiqueToolInputSchema,
  toCritiqueResult,
  type CritiqueResult,
} from "../lib/contentops/critique";
import { listDrafts } from "../lib/contentops/drafts-store";
import {
  buildLinkTargetsMenu,
  validateAndCleanLinks,
  type LinkTargets,
} from "../lib/contentops/link-validation";
import { PAKISTAN_BRIEF } from "../lib/contentops/pakistan-brief";
import { products } from "../lib/products";
import { SAFETY_BRIEF } from "../lib/contentops/safety";
import { chooseTemplate } from "../lib/contentops/template";
import { getSupabaseAdminClient } from "../lib/supabase-admin";

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 4000;
const TIMEOUT_MS = 60_000;
const TOOL_NAME = "submit_blog_post";
const LOG_PREFIX = "[contentops-draft]";

function fail(message: string): never {
  console.error(`${LOG_PREFIX} ${message}`);
  process.exit(1);
}

function parseTopic(): string {
  const topic = process.argv[2]?.trim();
  if (!topic) {
    fail('Usage: npm run contentops:draft -- "<topic>"');
  }
  if (topic.length < 5 || topic.length > 200) {
    fail(`Topic must be 5-200 characters (got ${topic.length}).`);
  }
  return topic;
}

function assertEnv(): string {
  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!anthropicKey) {
    fail("ANTHROPIC_API_KEY is required. Set it in your local environment.");
  }
  if (!process.env.SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    fail("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }
  return anthropicKey;
}

async function pingSupabase() {
  const client = getSupabaseAdminClient();
  if (!client) {
    fail("Supabase client could not be initialized. Check env vars.");
  }
  const { error } = await client
    .from("contentops_drafts")
    .select("id", { count: "exact", head: true });
  if (error) {
    fail(
      `Supabase connectivity check failed: ${error.message}. ` +
        "Has supabase/contentops-schema.sql been applied to this database?",
    );
  }
  return client;
}

async function checkSlugAvailable(
  client: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  slug: string,
) {
  const { data, error } = await client
    .from("contentops_drafts")
    .select("id, status")
    .eq("slug", slug)
    .in("status", ["pending_review", "approved"])
    .limit(1);
  if (error) {
    fail(`Slug-availability check failed: ${error.message}`);
  }
  const existing = data?.[0];
  if (existing) {
    fail(
      `Slug "${slug}" already has an active draft ` +
        `(id=${existing.id}, status=${existing.status}). ` +
        "Reject or publish it before regenerating.",
    );
  }
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

async function generateDraft(
  anthropic: Anthropic,
  topic: string,
  corpus: CorpusEntry[],
): Promise<BlogPost> {
  const { system, user } = buildPrompt(topic, corpus);
  const inputSchema = z.toJSONSchema(blogPostSchema) as Record<string, unknown>;

  const response = await anthropic.messages.create(
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

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    fail(
      `Model did not return a tool_use block (stop_reason=${response.stop_reason}). ` +
        "Try a different topic or check API status.",
    );
  }

  const parsed = blogPostSchema.safeParse(toolUse.input);
  if (!parsed.success) {
    console.error(`${LOG_PREFIX} Zod validation failed for model output:`);
    console.error(JSON.stringify(parsed.error.flatten(), null, 2));
    console.error(`${LOG_PREFIX} Raw tool input was:`);
    console.error(JSON.stringify(toolUse.input, null, 2));
    fail("Generated draft failed schema validation. No DB write performed.");
  }
  // heroImage is a REVIEWER-only field (set via the hero-image picker →
  // the hero_image_path column), never authored by the model. Strip it so
  // the model can't fabricate an image URL (it invents dead external URLs);
  // the reviewer chooses a real /public asset in the admin.
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
    console.log(
      `${LOG_PREFIX} Critique pass skipped (${err instanceof Error ? err.message : "error"}).`,
    );
    return null;
  }
}

async function insertDraft(
  client: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  draft: BlogPost,
  critique: CritiqueResult | null,
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
    console.log(
      `${LOG_PREFIX} 'critique' column not found — apply supabase/contentops-schema.sql to store critiques. Inserting without it.`,
    );
    ({ data, error } = await client
      .from("contentops_drafts")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert(baseRow as any)
      .select("id, slug")
      .single());
  }
  if (error || !data) {
    console.error(`${LOG_PREFIX} Insert failed. Validated draft was:`);
    console.error(JSON.stringify(draft, null, 2));
    fail(`Supabase insert failed: ${error?.message ?? "unknown error"}`);
  }
  return data;
}

async function main() {
  const topic = parseTopic();
  const anthropicKey = assertEnv();
  const client = await pingSupabase();
  const anthropic = new Anthropic({ apiKey: anthropicKey });

  // Duplicate-intent guard — refuse before spending tokens when the topic
  // substantially overlaps something we already cover (or have queued).
  const corpus = await loadCorpus();
  const overlaps = findTopicOverlap(topic, corpus);
  const worst = overlaps[0];
  if (worst && worst.score >= DUPLICATE_INTENT_THRESHOLD) {
    fail(
      `Topic overlaps an existing post (${Math.round(worst.score * 100)}% intent match): ` +
        `"${worst.title}" (/blog/${worst.slug}). ` +
        "Refresh that post instead of splitting its ranking signal, or pick a more specific angle.",
    );
  }
  if (worst && worst.score >= DUPLICATE_INTENT_WARN) {
    console.log(
      `${LOG_PREFIX} Note: closest existing post is "${worst.title}" (${Math.round(worst.score * 100)}% overlap) — keep this angle distinct.`,
    );
  }

  console.log(`${LOG_PREFIX} Generating draft for: "${topic}"`);
  const rawDraft = await generateDraft(anthropic, topic, corpus);

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
    console.log(
      `${LOG_PREFIX} Stripped ${strippedLinks.length} invalid link(s): ` +
        strippedLinks.map((l) => l.href).join(", "),
    );
  }
  if (validLinkCount === 0) {
    console.log(
      `${LOG_PREFIX} Warning: draft has NO valid internal links — the reviewer should add one.`,
    );
  }

  await checkSlugAvailable(client, draft.slug);

  console.log(`${LOG_PREFIX} Running Opus critique pass...`);
  const critique = await runCritique(anthropic, draft, corpus);
  if (critique) {
    console.log(`${LOG_PREFIX} Critique: ${critique.flags.length} flag(s).`);
    for (const f of critique.flags) {
      console.log(`  [${f.severity}/${f.category}] ${f.location}: ${f.note}`);
    }
  }

  const inserted = await insertDraft(client, draft, critique);

  console.log(
    `${LOG_PREFIX} OK. id=${inserted.id} slug=${inserted.slug} title="${draft.title}" (${validLinkCount} valid link(s))`,
  );
}

main().catch((err) => {
  const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  fail(message);
});
