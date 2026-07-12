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
  "- When a topic is health-sensitive, it is better to under-claim and defer to a pediatrician than to sound authoritative.",
].join("\n");
