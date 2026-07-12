// Template variation for the drafting model. The audit found every draft
// used the identical 7-section skeleton + 5 FAQs — ten of these and the
// blog reads machine-stamped. Picking a structure that fits the topic
// TYPE gives each post a natural shape and breaks the fingerprint.

export type DraftTemplate = {
  name: string;
  guidance: string;
};

const TEMPLATES: Record<string, DraftTemplate> = {
  how_to: {
    name: "how-to",
    guidance: [
      "STRUCTURE — step-by-step how-to (5-6 sections):",
      "why it matters → what you need first → the steps in order → the mistakes people make → when to adjust / aftercare. 3-4 FAQ entries.",
      "Lead with reassurance, then get concrete and sequential. Numbered, unambiguous steps.",
    ].join(" "),
  },
  comparison: {
    name: "comparison",
    guidance: [
      "STRUCTURE — comparison (4-5 sections):",
      "the core difference up front → when to choose A → when to choose B → how they work together (if they do) → a plain recommendation. 3 FAQ entries.",
      "Decisive, not wishy-washy — the reader wants a clear call.",
    ].join(" "),
  },
  checklist: {
    name: "checklist",
    guidance: [
      "STRUCTURE — prioritised checklist (5-6 sections):",
      "why generic lists overspend → the true essentials by daily need (sleep, feeding, dressing) → a phased buy (before birth / weeks 2-4 / month 2+) → what to skip → one tight summary list. 4-5 FAQ entries.",
      "Honest and restrained — a real parent should trust it isn't padded to sell more.",
    ].join(" "),
  },
  buying_guide: {
    name: "buying-guide",
    guidance: [
      "STRUCTURE — buying guide (5-7 sections):",
      "what actually matters most → the key decision factors one by one → seasonal/local fit → how to judge quality → what to skip. 4-5 FAQ entries.",
      "Teach the reader to choose well generally; let product pages carry specifics.",
    ].join(" "),
  },
  informational: {
    name: "informational",
    guidance: [
      "STRUCTURE — explainer (5-7 sections):",
      "open with the parent's real question, then build understanding in a logical arc, close with practical takeaways. 4-5 FAQ entries.",
      "Vary section shape to fit the subject — do not force a fixed skeleton.",
    ].join(" "),
  },
};

/** Pick a template from the topic's shape. Deterministic, keyword-driven. */
export function chooseTemplate(topic: string): DraftTemplate {
  const t = topic.toLowerCase();
  if (/\bvs\b|versus|\bor\b|difference between|compared?/.test(t)) return TEMPLATES.comparison;
  if (/how to|how do|steps|step-by-step|guide to \w+ing/.test(t)) return TEMPLATES.how_to;
  if (/checklist|essentials|what to buy|must-?haves?|what do i need|shopping list/.test(t))
    return TEMPLATES.checklist;
  if (/best|how to choose|what to look for|choosing|buying/.test(t)) return TEMPLATES.buying_guide;
  return TEMPLATES.informational;
}
