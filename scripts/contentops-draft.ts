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
import { blogPostSchema, type BlogPost } from "../lib/contentops/blog-schema";
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

function buildPrompt(topic: string) {
  const example = blogPosts[0];
  const exampleJson = JSON.stringify(example, null, 2);

  const system = [
    "You write SEO blog drafts for Little Smiles, a premium boutique baby brand based in Pakistan.",
    "Audience: parents (primarily mothers) of newborns to 2-year-olds, browsing in English on mobile.",
    "Voice: calm, editorial, practical. Not pushy. Not generic. Not full of hype.",
    "Each post answers one parent question deeply, with 3+ sections, 2-4 line paragraphs, and a single relevant CTA to a shop category.",
    "Output exactly one call to the submit_blog_post tool. Do not include text outside the tool call.",
  ].join(" ");

  const user = [
    `Topic: ${topic}`,
    "",
    "Match the tone, structure, length, and CTA pattern of this existing post:",
    "",
    exampleJson,
    "",
    "Now write a new post on the topic above. Use a fresh slug (lowercase, hyphen-separated, unique).",
    "Pick the most relevant `category` and `relatedProductCategory` from the schema's allowed values.",
    "Do not copy the example's wording.",
  ].join("\n");

  return { system, user };
}

async function generateDraft(anthropic: Anthropic, topic: string): Promise<BlogPost> {
  const { system, user } = buildPrompt(topic);
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
  return parsed.data;
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

  console.log(`${LOG_PREFIX} Generating draft for: "${topic}"`);
  const draft = await generateDraft(anthropic, topic);
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
