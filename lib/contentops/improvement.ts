// Content improvement engine — deterministic recommendations for thin or
// under-optimised drafts. Every suggestion is derivable from real repo
// data (lib/blog.ts, lib/products.ts, lib/seo-intelligence/...). No
// external LLM call is made automatically; the optional "Generate
// improved draft" CTA is rendered disabled unless an explicit env flag
// is set, and even then the action is a separate user gesture.
//
// Targets — chosen to mirror the existing thresholds in
// draft-validation.ts so a draft that hits these will also flip its
// queue badges to green.

import { products, type Product } from "@/lib/products";
import { blogPosts, type BlogPost } from "@/lib/blog";
import { validateDraft, type DraftValidationReport } from "@/lib/contentops/draft-validation";
import { type Draft } from "@/lib/contentops/drafts-store";

export const IMPROVEMENT_TARGETS = {
  /** Target word band — 700-1200 keeps Google's preferred long-form depth without filler. */
  wordCountMin: 700,
  wordCountMax: 1200,
  /** Section count target — enough subheadings for scannability + topical coverage. */
  sectionCountMin: 5,
  sectionCountMax: 7,
  /** FAQ entries when the post format supports them. */
  faqMin: 3,
  faqMax: 5,
  /** Minimum count of internal/product links in the body. */
  internalLinkMin: 1,
  /** Title/description targets — match draft-validation. */
  titleMin: 30,
  titleMax: 70,
  descriptionMin: 80,
  descriptionMax: 160,
  keywordsMin: 3,
} as const;

export type ImprovementWeakness =
  | "word_count_too_low"
  | "word_count_too_high"
  | "section_count_too_low"
  | "missing_internal_links"
  | "missing_product_cta"
  | "weak_metadata_title"
  | "weak_metadata_description"
  | "too_few_keywords"
  | "missing_faq"
  | "missing_hero_image"
  | "weak_topical_depth";

export type ImprovementWeaknessEntry = {
  key: ImprovementWeakness;
  label: string;
  detail: string;
};

export type SuggestedSection = {
  heading: string;
  rationale: string;
};

export type SuggestedFaq = {
  question: string;
  rationale: string;
};

export type SuggestedInternalLink = {
  toKind: "blog" | "product" | "category";
  toSlugOrCategory: string;
  toTitle: string;
  suggestedAnchor: string;
  reason: string;
};

export type ImprovementRecommendation = {
  /** Target band the reviewer should aim for. */
  targets: typeof IMPROVEMENT_TARGETS;
  suggestedSections: SuggestedSection[];
  suggestedFaqs: SuggestedFaq[];
  suggestedInternalLinks: SuggestedInternalLink[];
  suggestedProductCta: { slug: string; name: string; reason: string } | null;
  /** Concrete "do this next" list, ordered by impact. */
  nextActions: string[];
};

export type SimpleChecklistStatus = "needs_work" | "done";

export type SimpleChecklistStep = {
  key:
    | "expand_article"
    | "add_faq"
    | "add_internal_link"
    | "review_title_meta"
    | "prepare_publish";
  label: string;
  status: SimpleChecklistStatus;
  detail: string;
};

export type DraftImprovementReport = {
  validation: DraftValidationReport;
  weaknesses: ImprovementWeaknessEntry[];
  recommendation: ImprovementRecommendation;
  /** Five-step plain-language plan for a non-technical reviewer. */
  simpleChecklist: SimpleChecklistStep[];
  /** True when at least one weakness exists. */
  needsImprovement: boolean;
  /** True only when ANTHROPIC_API_KEY is configured AND the per-action env flag is set. */
  aiGenerationAvailable: boolean;
  aiGenerationDisabledReason: string | null;
};

function pickAnchorProduct(post: BlogPost): Product | null {
  const inCategory = products.filter((p) => p.category === post.relatedProductCategory);
  return (
    inCategory.find((p) => p.featured && p.inStock) ??
    inCategory.find((p) => p.inStock) ??
    inCategory[0] ??
    null
  );
}

function buildSectionSuggestions(post: BlogPost, currentSectionCount: number): SuggestedSection[] {
  if (currentSectionCount >= IMPROVEMENT_TARGETS.sectionCountMin) return [];
  // Use the post's category + relatedProductCategory to propose deterministic
  // section ideas that obviously make sense for the topic, without inventing
  // generic filler.
  const category = post.relatedProductCategory;
  const ideas: SuggestedSection[] = [
    {
      heading: `What to look for in a quality ${category.toLowerCase()}`,
      rationale: `Adds buyer-intent depth for category "${category}". Helps queries like "best ${category.toLowerCase()} for…".`,
    },
    {
      heading: "Common mistakes parents make",
      rationale: "Anticipates user objections — strong on-page signal for informational queries.",
    },
    {
      heading: "How to care for and clean it",
      rationale: "Care/aftermath sections target long-tail queries and increase dwell time.",
    },
    {
      heading: "Quick comparison: when to choose which",
      rationale: "Comparison phrasing surfaces in featured snippets when other sections rank.",
    },
    {
      heading: "Pakistan-specific tips",
      rationale: "Localises the post for the brand's primary market — competing with non-local content.",
    },
  ];
  const need = IMPROVEMENT_TARGETS.sectionCountMin - currentSectionCount;
  return ideas.slice(0, Math.max(need, 1));
}

function buildFaqSuggestions(post: BlogPost): SuggestedFaq[] {
  const category = post.relatedProductCategory;
  return [
    {
      question: `What age is a ${category.toLowerCase()} recommended for?`,
      rationale: "Common pre-purchase question for parents — FAQ schema can earn People Also Ask placement.",
    },
    {
      question: `How many ${category.toLowerCase()}s does a newborn actually need?`,
      rationale: "High-intent purchase-stage query, low effort to answer authoritatively.",
    },
    {
      question: `How do I wash and care for a ${category.toLowerCase()}?`,
      rationale: "Care instructions are evergreen and rank on long-tail queries.",
    },
  ].slice(0, IMPROVEMENT_TARGETS.faqMin);
}

function existingLinkedSlugs(post: BlogPost): Set<string> {
  const slugs = new Set<string>();
  const text = [
    ...post.sections.flatMap((s) => [s.heading, ...s.content]),
    post.cta.href,
  ].join("\n");
  const matches = text.matchAll(/\/(shop|blog)\/([A-Za-z0-9_-]+)/g);
  for (const m of matches) slugs.add(m[2]);
  return slugs;
}

function buildInternalLinkSuggestions(post: BlogPost): SuggestedInternalLink[] {
  const existing = existingLinkedSlugs(post);
  const out: SuggestedInternalLink[] = [];

  // 1) Strongest in-category in-stock product.
  const anchor = pickAnchorProduct(post);
  if (anchor && !existing.has(anchor.slug)) {
    out.push({
      toKind: "product",
      toSlugOrCategory: anchor.slug,
      toTitle: anchor.name,
      suggestedAnchor: anchor.name,
      reason: `Anchor product for category "${post.relatedProductCategory}" — featured/in-stock.`,
    });
  }

  // 2) One related blog post sharing at least one keyword.
  const ownKeywords = new Set(post.keywords.map((k) => k.toLowerCase()));
  const peer = blogPosts.find((b) => {
    if (b.slug === post.slug) return false;
    if (existing.has(b.slug)) return false;
    return b.keywords.some((k) => ownKeywords.has(k.toLowerCase()));
  });
  if (peer) {
    const shared = peer.keywords.find((k) => ownKeywords.has(k.toLowerCase())) ?? peer.title;
    out.push({
      toKind: "blog",
      toSlugOrCategory: peer.slug,
      toTitle: peer.title,
      suggestedAnchor: shared,
      reason: "Shares keyword(s) with this draft — strengthens topical cluster.",
    });
  }

  // 3) Category index link.
  out.push({
    toKind: "category",
    toSlugOrCategory: post.relatedProductCategory,
    toTitle: `${post.relatedProductCategory} collection`,
    suggestedAnchor: `${post.relatedProductCategory} collection`,
    reason: `Category landing page for "${post.relatedProductCategory}" — drives commercial intent.`,
  });

  return out;
}

function buildProductCta(post: BlogPost): ImprovementRecommendation["suggestedProductCta"] {
  const anchor = pickAnchorProduct(post);
  if (!anchor) return null;
  return {
    slug: anchor.slug,
    name: anchor.name,
    reason: `Strongest in-category anchor — ${anchor.featured ? "featured · " : ""}${anchor.inStock ? "in stock" : "out of stock"}.`,
  };
}

export function buildDraftImprovementReport(draft: Draft): DraftImprovementReport {
  const validation = validateDraft(draft);
  const post = draft.content;
  const weaknesses: ImprovementWeaknessEntry[] = [];

  if (validation.wordCount < IMPROVEMENT_TARGETS.wordCountMin) {
    weaknesses.push({
      key: "word_count_too_low",
      label: "Word count too low",
      detail: `${validation.wordCount} words — target ${IMPROVEMENT_TARGETS.wordCountMin}-${IMPROVEMENT_TARGETS.wordCountMax}.`,
    });
  } else if (validation.wordCount > IMPROVEMENT_TARGETS.wordCountMax) {
    weaknesses.push({
      key: "word_count_too_high",
      label: "Word count slightly high",
      detail: `${validation.wordCount} words — target ${IMPROVEMENT_TARGETS.wordCountMin}-${IMPROVEMENT_TARGETS.wordCountMax}. Consider tightening filler paragraphs.`,
    });
  }

  if (validation.sectionCount < IMPROVEMENT_TARGETS.sectionCountMin) {
    weaknesses.push({
      key: "section_count_too_low",
      label: "Too few sections",
      detail: `${validation.sectionCount} sections — target ${IMPROVEMENT_TARGETS.sectionCountMin}-${IMPROVEMENT_TARGETS.sectionCountMax}.`,
    });
  }

  if (validation.internalLinkCount < IMPROVEMENT_TARGETS.internalLinkMin) {
    weaknesses.push({
      key: "missing_internal_links",
      label: "No internal links in body",
      detail: "Add at least one /shop/<slug>, /blog/<slug>, or /shop?category=… reference inside the article.",
    });
  }

  if (post.title.length < IMPROVEMENT_TARGETS.titleMin || post.title.length > IMPROVEMENT_TARGETS.titleMax) {
    weaknesses.push({
      key: "weak_metadata_title",
      label: "Title length out of band",
      detail: `${post.title.length} chars — target ${IMPROVEMENT_TARGETS.titleMin}-${IMPROVEMENT_TARGETS.titleMax}.`,
    });
  }

  if (
    post.description.length < IMPROVEMENT_TARGETS.descriptionMin ||
    post.description.length > IMPROVEMENT_TARGETS.descriptionMax
  ) {
    weaknesses.push({
      key: "weak_metadata_description",
      label: "Description length out of band",
      detail: `${post.description.length} chars — target ${IMPROVEMENT_TARGETS.descriptionMin}-${IMPROVEMENT_TARGETS.descriptionMax}.`,
    });
  }

  if (post.keywords.length < IMPROVEMENT_TARGETS.keywordsMin) {
    weaknesses.push({
      key: "too_few_keywords",
      label: "Too few keywords",
      detail: `${post.keywords.length} keyword(s) — target ≥ ${IMPROVEMENT_TARGETS.keywordsMin}.`,
    });
  }

  if (!validation.hasAnchorProduct) {
    weaknesses.push({
      key: "missing_hero_image",
      label: "No anchor product → no hero image",
      detail: `Category "${post.relatedProductCategory}" has no eligible product to use as hero.`,
    });
  }

  // Topical depth — fewer than 350 words AND fewer than 3 sections is a
  // strong signal the post is summary-only.
  if (validation.wordCount < 350 && validation.sectionCount < 3) {
    weaknesses.push({
      key: "weak_topical_depth",
      label: "Weak topical depth",
      detail: "Post reads like a summary — add concrete examples, comparisons, and care/usage detail.",
    });
  }

  // FAQ — we don't yet store FAQ entries in the schema, so flag as missing
  // when the draft is also flagged as thin. (When the schema is extended
  // to carry FAQs, this check becomes structural.)
  const hasFaqHeading = post.sections.some((s) => /faq|frequently|common questions/i.test(s.heading));
  if (!hasFaqHeading && (validation.wordCount < 700 || validation.sectionCount < 5)) {
    weaknesses.push({
      key: "missing_faq",
      label: "No FAQ section",
      detail: "Adding 3-5 FAQ entries opens People Also Ask placement and increases dwell time.",
    });
  }

  // Product CTA — flag when the CTA href is the malformed default.
  if (!/^\/shop\?category=.+$/.test(post.cta.href)) {
    weaknesses.push({
      key: "missing_product_cta",
      label: "CTA does not point at a real category",
      detail: `Current CTA href: "${post.cta.href}". Use /shop?category=<category> with the post's relatedProductCategory.`,
    });
  }

  const suggestedSections = buildSectionSuggestions(post, validation.sectionCount);
  const suggestedFaqs = hasFaqHeading ? [] : buildFaqSuggestions(post);
  const suggestedInternalLinks = buildInternalLinkSuggestions(post);
  const suggestedProductCta = buildProductCta(post);

  const nextActions: string[] = [];
  if (weaknesses.some((w) => w.key === "section_count_too_low")) {
    nextActions.push(`Add ${IMPROVEMENT_TARGETS.sectionCountMin - validation.sectionCount} more section(s) — see suggested headings below.`);
  }
  if (weaknesses.some((w) => w.key === "word_count_too_low")) {
    nextActions.push(`Expand to ${IMPROVEMENT_TARGETS.wordCountMin}+ words by adding concrete examples and parent-facing detail.`);
  }
  if (weaknesses.some((w) => w.key === "missing_internal_links")) {
    nextActions.push("Add at least one internal link to a related blog post or product slug inside the body.");
  }
  if (weaknesses.some((w) => w.key === "missing_faq")) {
    nextActions.push("Add an FAQ section with 3 questions — see suggested questions below.");
  }
  if (weaknesses.some((w) => w.key === "weak_metadata_title")) {
    nextActions.push("Rewrite the title to land between 30–70 characters with the primary keyword near the front.");
  }
  if (weaknesses.some((w) => w.key === "weak_metadata_description")) {
    nextActions.push("Rewrite the meta description to 80–160 characters with the primary keyword and a clear value prop.");
  }
  if (weaknesses.some((w) => w.key === "too_few_keywords")) {
    nextActions.push("Add 1-2 specific long-tail keywords to keywords[] — match how parents actually search.");
  }
  if (weaknesses.some((w) => w.key === "missing_product_cta")) {
    nextActions.push("Fix the CTA href to /shop?category=<relatedProductCategory>.");
  }

  // AI generation availability — never auto-runs, always behind an
  // explicit env flag the operator sets per-deployment.
  const hasAiKey = Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  const aiEnabled = hasAiKey && process.env.CONTENTOPS_IMPROVE_ENABLED === "1";
  const aiGenerationDisabledReason = aiEnabled
    ? null
    : !hasAiKey
      ? "ANTHROPIC_API_KEY is not configured."
      : "Set CONTENTOPS_IMPROVE_ENABLED=1 to enable assisted draft improvement.";

  const weaknessKeys = new Set(weaknesses.map((w) => w.key));
  const expandFlag =
    weaknessKeys.has("word_count_too_low") ||
    weaknessKeys.has("section_count_too_low") ||
    weaknessKeys.has("weak_topical_depth");
  const titleMetaFlag =
    weaknessKeys.has("weak_metadata_title") ||
    weaknessKeys.has("weak_metadata_description") ||
    weaknessKeys.has("too_few_keywords");
  const stepFlags = {
    expand_article: expandFlag,
    add_faq: weaknessKeys.has("missing_faq"),
    add_internal_link: weaknessKeys.has("missing_internal_links"),
    review_title_meta: titleMetaFlag,
  };
  const stepDone = (flag: boolean): SimpleChecklistStatus => (flag ? "needs_work" : "done");
  const anyEarlierNeedsWork = Object.values(stepFlags).some(Boolean) || weaknesses.length > 0;

  const simpleChecklist: SimpleChecklistStep[] = [
    {
      key: "expand_article",
      label: "1. Expand article",
      status: stepDone(stepFlags.expand_article),
      detail: stepFlags.expand_article
        ? `Reach ${IMPROVEMENT_TARGETS.wordCountMin}-${IMPROVEMENT_TARGETS.wordCountMax} words across ${IMPROVEMENT_TARGETS.sectionCountMin}-${IMPROVEMENT_TARGETS.sectionCountMax} sections. See suggested headings below.`
        : "Length and section count look healthy.",
    },
    {
      key: "add_faq",
      label: "2. Add FAQ",
      status: stepDone(stepFlags.add_faq),
      detail: stepFlags.add_faq
        ? `Add ${IMPROVEMENT_TARGETS.faqMin}-${IMPROVEMENT_TARGETS.faqMax} short FAQ entries — see suggested questions below.`
        : "FAQ section already present (or not required for this length).",
    },
    {
      key: "add_internal_link",
      label: "3. Add internal link",
      status: stepDone(stepFlags.add_internal_link),
      detail: stepFlags.add_internal_link
        ? "Add at least one /shop/<slug>, /blog/<slug>, or /shop?category=… reference inside the article body."
        : "Body already contains at least one internal link.",
    },
    {
      key: "review_title_meta",
      label: "4. Review title / meta",
      status: stepDone(stepFlags.review_title_meta),
      detail: stepFlags.review_title_meta
        ? `Title ${IMPROVEMENT_TARGETS.titleMin}-${IMPROVEMENT_TARGETS.titleMax} chars · description ${IMPROVEMENT_TARGETS.descriptionMin}-${IMPROVEMENT_TARGETS.descriptionMax} chars · ≥${IMPROVEMENT_TARGETS.keywordsMin} keywords.`
        : "Title, description, and keywords are within the recommended bands.",
    },
    {
      key: "prepare_publish",
      label: "5. Prepare publish",
      status: anyEarlierNeedsWork ? "needs_work" : "done",
      detail: anyEarlierNeedsWork
        ? "Only open Prepare publish once the four steps above are green."
        : "Safe to open Prepare publish — all improvement checks pass.",
    },
  ];

  return {
    validation,
    weaknesses,
    recommendation: {
      targets: IMPROVEMENT_TARGETS,
      suggestedSections,
      suggestedFaqs,
      suggestedInternalLinks,
      suggestedProductCta,
      nextActions,
    },
    simpleChecklist,
    needsImprovement: weaknesses.length > 0,
    aiGenerationAvailable: aiEnabled,
    aiGenerationDisabledReason,
  };
}
