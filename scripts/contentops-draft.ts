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
import { listDrafts } from "../lib/contentops/drafts-store";
import { PAKISTAN_BRIEF } from "../lib/contentops/pakistan-brief";
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

  const system = [
    "You write SEO blog drafts for Little Smiles, a premium boutique baby brand based in Pakistan.",
    "Audience: parents (primarily mothers) of newborns to 2-year-olds, browsing in English on mobile.",
    "Voice: calm, editorial, practical. Not pushy. Not generic. Not full of hype.",
    "Answer one parent question deeply, with 2-4 line paragraphs and a single relevant CTA to a shop category. Follow the STRUCTURE guidance below for section and FAQ shape — do not force a fixed skeleton across posts.",
    "Each faq answer is short and direct — a real pre-purchase question.",
    "Weave 1-2 internal links into body paragraphs using markdown syntax with INTERNAL paths only:",
    "[anchor text](/shop?category=<relatedProductCategory>) or [anchor text](/blog/<existing-post-slug>).",
    "Only link to blog slugs that appear in the existing-post list; never invent product slugs.",
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

async function insertDraft(
  client: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  draft: BlogPost,
) {
  const { data, error } = await client
    .from("contentops_drafts")
    .insert({
      slug: draft.slug,
      status: "pending_review",
      content: draft,
      hero_image_path: null,
      rejection_note: null,
      approved_at: null,
      published_at: null,
    })
    .select("id, slug")
    .single();
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
  const draft = await generateDraft(anthropic, topic, corpus);
  await checkSlugAvailable(client, draft.slug);
  const inserted = await insertDraft(client, draft);

  console.log(
    `${LOG_PREFIX} OK. id=${inserted.id} slug=${inserted.slug} title="${draft.title}"`,
  );
}

main().catch((err) => {
  const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  fail(message);
});
