// YMYL (Your Money or Your Life) safety layer for baby content. Infant
// sleep, swaddling, and feeding are health-sensitive topics; the audit
// found confident medical-adjacent claims with no "consult your
// pediatrician" caveat. This makes the caveat STRUCTURAL — rendered from
// the category, so it can never be forgotten by a draft or a reviewer.

import type { BlogCategory } from "@/lib/contentops/blog-schema";

/** Categories that touch infant health/safety and must carry the caveat. */
const YMYL_CATEGORIES = new Set<BlogCategory>(["Newborn Care", "Feeding"]);

export function isYmylCategory(category: BlogCategory): boolean {
  return YMYL_CATEGORIES.has(category);
}

export const MEDICAL_DISCLAIMER =
  "This guide is general information for parents, not medical advice. Every baby is different — for anything about your baby's sleep, health, or feeding, follow the guidance of your pediatrician.";

/**
 * Safety rules injected into the drafting prompt for every post. Pairs
 * with the structural on-page disclaimer: the model must not make
 * definitive medical claims and must frame safety-sensitive advice
 * carefully.
 */
export const SAFETY_BRIEF = [
  "INFANT SAFETY (this is baby content — treat as YMYL):",
  "- Never give definitive medical, sleep-safety, or feeding directives as fact. Frame as general guidance parents can discuss with their pediatrician.",
  "- For sleep/swaddling: always pair advice with the safe-sleep basics (baby on their back; stop swaddling at the first signs of rolling; watch for overheating). Do not invent specific ages, temperatures, or measurements as if they were clinical standards — use ranges and 'typically'.",
  "- Do not diagnose, or advise on medication, supplements, or medical conditions.",
  // Product-misuse framing: catch not just direct unsafe claims but presenting a
  // product as a convenient workaround for an unsafe use. Caveats must LEAD.
  "- Do not frame a product as a handy workaround for a use it is not designed for (e.g. a feeding cushion for tummy time, propping, or sleep positioning; a pillow or nest for unsupervised sleep). When a use carries a suffocation, positioning, or fall risk, LEAD with the caution — never for unsupervised use, never for sleep — instead of presenting the risky use as a helpful tip with a mild caveat trailing after. If in doubt, advise against the off-label use rather than enabling it.",
  "- When a topic is health-sensitive, it is better to under-claim and defer to a pediatrician than to sound authoritative.",
].join("\n");

/**
 * Business-policy guard for the drafting + expansion prompts. The critique found
 * the model inventing a specific, false COD/inspection policy ("inspect in hand,
 * only then commit"). The model cannot know these terms — they are never in its
 * context — so it must not state them as fact.
 */
export const BUSINESS_POLICY_BRIEF = [
  "BUSINESS-POLICY FACTS — NEVER INVENT:",
  "- You do NOT know Little Smiles' specific policies. Never state any of these as fact unless the exact terms are given to you in this prompt: cash-on-delivery / payment terms (including whether payment or inspection comes first), returns, refunds, exchanges, delivery times or guarantees, warranties, discounts, or inspection rights.",
  "- In particular, do NOT claim customers can inspect a product before paying, pay only after delivery or inspection, or return/refund on any specific terms — these are commonly false.",
  "- When a sentence would assert such a policy, omit it or stay generic about the shopping experience ('confirm the store's terms', 'ask the seller over WhatsApp') — never fabricate a specific term.",
].join("\n");
