// Parent-question phrasing for topic suggestions — the "light phrasing" step.
//
// Turns an uncovered keyword into a single, specific "parent question" (the form
// works best with one specific question). Uses Haiku 4.5 — cheap phrasing, not
// content writing — and is aggressively BOUNDED:
//
//   • module-level cache keyed by normalized keyword (opportunities are derived
//     and stable, so a question is reused across renders/requests in a server
//     instance — a warm cache makes zero model calls);
//   • only UNCACHED keywords hit the model, in ONE batched call, capped at
//     MAX_KEYWORDS_PER_CALL;
//   • a deterministic template fallback covers a missing key / failure / timeout,
//     so the panel always renders and never blocks on the model.

import Anthropic from "@anthropic-ai/sdk";

import {
  normalizeKeyword,
  type KeywordOpportunityIntent,
} from "@/lib/seo-intelligence/keyword-opportunities";

const QUESTION_MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 700;
const TIMEOUT_MS = 15_000;
const TOOL_NAME = "submit_parent_questions";
const MAX_KEYWORDS_PER_CALL = 8;

// Normalized keyword → generated question. Only LLM-produced questions are
// cached; template fallbacks are not, so a later configured/successful run can
// upgrade them. Bounded in practice by the small, stable opportunity set.
const questionCache = new Map<string, string>();

export type QuestionInput = { keyword: string; intent: KeywordOpportunityIntent };

/** Deterministic fallback used when the model is unavailable/fails. Always
 *  grammatical for the noun-phrase keywords this engine produces; intentionally
 *  plain — the model call is what makes it natural. */
export function templateQuestion(keyword: string, intent: KeywordOpportunityIntent): string {
  const k = keyword.trim();
  const q =
    intent === "commercial" || intent === "comparison"
      ? `How do I choose the right ${k}?`
      : intent === "how_to"
        ? `How do I use a ${k}?`
        : `What should parents know about ${k}?`;
  return q.charAt(0).toUpperCase() + q.slice(1);
}

const toolInputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    questions: {
      type: "array",
      description: "One parent question per input keyword, in the same order.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          keyword: { type: "string", description: "Echo the input keyword verbatim." },
          question: {
            type: "string",
            description:
              "One natural, specific question a Pakistani parent would search — the kind that makes the best single blog post. Under ~90 characters. No preamble.",
          },
        },
        required: ["keyword", "question"],
      },
    },
  },
  required: ["questions"],
} as const;

function buildSystem(): string {
  return [
    "You turn a blog topic/keyword into ONE natural, specific parent question — the kind a parent of a newborn-to-toddler in Pakistan would type into Google, and the kind that makes the best single focused blog post.",
    "Rules: exactly one question per input keyword, in the same order; keep each under ~90 characters; specific, not generic; no preamble or numbering. Call the submit_parent_questions tool exactly once.",
  ].join("\n");
}

function buildUser(inputs: QuestionInput[]): string {
  return [
    "Turn each of these into one parent question:",
    ...inputs.map((i, idx) => `${idx + 1}. ${i.keyword} (intent: ${i.intent})`),
  ].join("\n");
}

function parseQuestions(rawInput: unknown): { keyword: string; question: string }[] {
  const raw = (rawInput as { questions?: unknown })?.questions;
  if (!Array.isArray(raw)) return [];
  const out: { keyword: string; question: string }[] = [];
  for (const item of raw) {
    const entry = item as { keyword?: unknown; question?: unknown };
    if (typeof entry.keyword === "string" && typeof entry.question === "string" && entry.question.trim()) {
      out.push({ keyword: entry.keyword, question: entry.question.trim().slice(0, 160) });
    }
  }
  return out;
}

/**
 * Return a map of normalized-keyword → parent question for every input. Serves
 * from cache first; only uncached keywords hit Haiku (one batched call, capped);
 * anything not returned by the model falls back to a deterministic template.
 * Never throws.
 */
export async function generateParentQuestions(inputs: QuestionInput[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const missing: { input: QuestionInput; key: string }[] = [];

  for (const input of inputs) {
    const key = normalizeKeyword(input.keyword);
    const cached = questionCache.get(key);
    if (cached) result.set(key, cached);
    else missing.push({ input, key });
  }
  if (missing.length === 0) return result;

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    for (const m of missing) result.set(m.key, templateQuestion(m.input.keyword, m.input.intent));
    return result;
  }

  // Only the first MAX_KEYWORDS_PER_CALL uncached keywords hit the model; any
  // overflow (shouldn't happen for a <=8 suggestion list) uses the template.
  const batch = missing.slice(0, MAX_KEYWORDS_PER_CALL);
  const overflow = missing.slice(MAX_KEYWORDS_PER_CALL);
  for (const m of overflow) result.set(m.key, templateQuestion(m.input.keyword, m.input.intent));

  try {
    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create(
      {
        model: QUESTION_MODEL,
        max_tokens: MAX_TOKENS,
        system: buildSystem(),
        tools: [
          {
            name: TOOL_NAME,
            description: "Return one parent question per input keyword.",
            input_schema: toolInputSchema as unknown as Anthropic.Messages.Tool["input_schema"],
          },
        ],
        tool_choice: { type: "tool", name: TOOL_NAME },
        messages: [{ role: "user", content: buildUser(batch.map((m) => m.input)) }],
      },
      { timeout: TIMEOUT_MS },
    );
    const toolUse = response.content.find((b) => b.type === "tool_use");
    const parsed = toolUse && toolUse.type === "tool_use" ? parseQuestions(toolUse.input) : [];
    const byKeyword = new Map(parsed.map((p) => [normalizeKeyword(p.keyword), p.question]));

    for (const m of batch) {
      const q = byKeyword.get(m.key);
      if (q) {
        questionCache.set(m.key, q); // cache only real LLM output
        result.set(m.key, q);
      } else {
        result.set(m.key, templateQuestion(m.input.keyword, m.input.intent)); // not cached — upgrade later
      }
    }
  } catch {
    for (const m of batch) result.set(m.key, templateQuestion(m.input.keyword, m.input.intent));
  }

  return result;
}
