// Shared draft generation. Both the CLI (scripts/contentops-draft.ts)
// and the in-app API route call this same function, so behavior stays
// consistent across surfaces.
//
// The brand-voice example is the first static post in lib/blog.ts —
// dynamic-imported so this module doesn't transitively pull blog
// rendering code into a hot generation path that doesn't need it.

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { blogPostSchema, type BlogPost } from "@/lib/contentops/blog-schema";
import { insertPendingReviewDraft } from "@/lib/contentops/drafts-store";
import { composeImagePrompts } from "@/lib/contentops/intelligence/image-prompts";

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 4000;
const TIMEOUT_MS = 60_000;
const TOOL_NAME = "submit_blog_post";

const TOPIC_MIN_LENGTH = 5;
const TOPIC_MAX_LENGTH = 200;

export type GeneratedDraft = {
  id: string;
  slug: string;
  title: string;
};

function buildPrompt(topic: string, exampleJson: string) {
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

async function generateDraftContent(topic: string): Promise<BlogPost> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!anthropicKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not configured on the server. Add it to the runtime environment before generating drafts.",
    );
  }

  // Dynamic import keeps the module graph minimal — the CLI doesn't
  // need to bundle blog rendering code at top-level either.
  const { blogPosts } = await import("@/lib/blog");
  const example = blogPosts[0];
  if (!example) {
    throw new Error("No brand-voice example available in lib/blog.ts.");
  }
  const exampleJson = JSON.stringify(example, null, 2);
  const { system, user } = buildPrompt(topic, exampleJson);

  // The model only writes editorial fields. imagePrompts is filled
  // deterministically by the composer after the model returns, so it's
  // stripped from the tool schema to keep the model focused.
  const modelFacingSchema = blogPostSchema.omit({ imagePrompts: true });
  const inputSchema = z.toJSONSchema(modelFacingSchema) as Record<string, unknown>;
  const anthropic = new Anthropic({ apiKey: anthropicKey });

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

  const toolUse = response.content.find(
    (b: { type: string }) => b.type === "tool_use",
  );
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error(
      `Model did not return a tool_use block (stop_reason=${response.stop_reason}). Try a different topic or retry.`,
    );
  }

  const parsed = modelFacingSchema.safeParse(toolUse.input);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(
      `The model's draft failed schema validation. First issues: ${issues}`,
    );
  }
  return parsed.data;
}

/**
 * End-to-end draft generation: validate the topic, call Anthropic, validate
 * the model output, persist as a pending_review draft. Returns a thin
 * summary suitable for both CLI logging and an API response payload.
 *
 * Throws clear, operator-readable Error.message strings on every failure
 * path so callers can surface them directly without translation.
 */
export async function generateDraftFromTopic(topic: string): Promise<GeneratedDraft> {
  const trimmed = topic.trim();
  if (trimmed.length < TOPIC_MIN_LENGTH || trimmed.length > TOPIC_MAX_LENGTH) {
    throw new Error(
      `Topic must be ${TOPIC_MIN_LENGTH}-${TOPIC_MAX_LENGTH} characters (got ${trimmed.length}).`,
    );
  }

  const content = await generateDraftContent(trimmed);

  // Compose deterministic image prompts at birth time. Operator can
  // copy them into Midjourney / Imagen / Flux while the Phase-2
  // provider integration is being wired in. The composer is pure and
  // cheap; we run it inline rather than as a separate API hop.
  const imagePrompts = composeImagePrompts({ post: content });
  const contentWithPrompts: BlogPost = { ...content, imagePrompts };

  const inserted = await insertPendingReviewDraft(contentWithPrompts);
  return {
    id: inserted.id,
    slug: inserted.slug,
    title: content.title,
  };
}
