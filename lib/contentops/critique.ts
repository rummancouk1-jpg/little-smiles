// Opus critique pass — a second, higher-tier model reads each generated draft
// against the catalog facts, safety rules, and existing corpus, and produces a
// short list of FLAGGED ISSUES for the human reviewer. It makes review faster
// and sharper; it never auto-fixes or auto-publishes. The human still edits
// and approves everything.
//
// This module is SDK-free (types + prompt builders + a parser) so the admin
// review screen can import the types and render the flags. The actual Opus
// call lives in the drafting CLI, which already has the Anthropic client.

import { type BlogPost } from "@/lib/contentops/blog-schema";

export const CRITIQUE_MODEL = "claude-opus-4-8";

export const CRITIQUE_CATEGORIES = [
  "invented_claim", // a store fact the catalog doesn't support
  "thin_local", // generic / not genuinely Pakistani
  "no_inline_link", // missing or weak internal linking
  "missing_faq", // FAQ absent or too few
  "ymyl_safety", // infant-safety claim needs a caveat / is risky
  "length", // too thin or padded
  "off_brand", // tone/hype/pushiness off the brand voice
  "accuracy", // a factual claim that reads wrong
  "other",
] as const;

export type CritiqueCategory = (typeof CRITIQUE_CATEGORIES)[number];
export type CritiqueSeverity = "info" | "warning" | "critical";

export type CritiqueFlag = {
  /** Where it is: a section heading, "FAQ", "meta", "title", "cta", or "overall". */
  location: string;
  severity: CritiqueSeverity;
  category: CritiqueCategory;
  /** One concrete, actionable sentence for the reviewer. */
  note: string;
};

export type CritiqueResult = {
  flags: CritiqueFlag[];
  model: string;
  createdAt: string;
};

/** JSON schema for the forced critique tool (mirrors CritiqueFlag). */
export const CRITIQUE_TOOL_NAME = "report_critique";
export const critiqueToolInputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    flags: {
      type: "array",
      description:
        "Specific, actionable issues for the human reviewer. Empty if the draft is clean. Order most-important first; cap at ~8.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          location: {
            type: "string",
            description:
              'Where it is: a section heading, "FAQ", "meta", "title", "cta", or "overall".',
          },
          severity: { type: "string", enum: ["info", "warning", "critical"] },
          category: { type: "string", enum: [...CRITIQUE_CATEGORIES] },
          note: {
            type: "string",
            description: "One concrete, actionable sentence for the reviewer.",
          },
        },
        required: ["location", "severity", "category", "note"],
      },
    },
  },
  required: ["flags"],
} as const;

export function buildCritiqueSystem(catalogBrief: string, safetyBrief: string): string {
  return [
    "You are a senior editor doing a fast pre-review of an AI-generated blog draft for Little Smiles, a premium boutique baby brand in Pakistan. A human reviewer will edit and approve it after you — your job is to make their pass faster and sharper by flagging the specific things they should check or fix.",
    "",
    "Flag, most-important first (cap ~8): invented store claims (anything about Little Smiles inventory the catalog below doesn't support — sizes, certifications, materials, delivery/discount promises); infant-safety issues on sleep/swaddling/feeding that need a pediatrician caveat or are stated too definitively; content that reads as generic Western baby-blog copy rather than genuinely Pakistani; missing or too-few FAQ; missing or weak internal links; thin or padded length; off-brand hype or pushiness; factual claims that read wrong.",
    "",
    "Rules: be specific and name the location. One actionable sentence per flag. Do NOT rewrite the draft. Do NOT flag things that are already fine — an excellent draft gets an empty flags array. Call the report_critique tool exactly once.",
    "",
    catalogBrief,
    "",
    safetyBrief,
  ].join("\n");
}

export function buildCritiqueUser(draft: BlogPost, corpusBrief: string): string {
  return [
    corpusBrief,
    "",
    "DRAFT TO CRITIQUE (JSON):",
    JSON.stringify(draft, null, 2),
  ].join("\n");
}

/** Parse + sanitize the model's tool input into a stored CritiqueResult. */
export function toCritiqueResult(rawInput: unknown, model: string): CritiqueResult {
  const flags: CritiqueFlag[] = [];
  const raw = (rawInput as { flags?: unknown })?.flags;
  if (Array.isArray(raw)) {
    for (const f of raw) {
      const entry = f as Partial<CritiqueFlag>;
      const severity: CritiqueSeverity =
        entry.severity === "critical" || entry.severity === "warning" ? entry.severity : "info";
      const category = (CRITIQUE_CATEGORIES as readonly string[]).includes(
        entry.category as string,
      )
        ? (entry.category as CritiqueCategory)
        : "other";
      if (typeof entry.note === "string" && entry.note.trim().length > 0) {
        flags.push({
          location: typeof entry.location === "string" && entry.location.trim() ? entry.location : "overall",
          severity,
          category,
          note: entry.note.trim().slice(0, 500),
        });
      }
    }
  }
  return { flags: flags.slice(0, 12), model, createdAt: new Date().toISOString() };
}
