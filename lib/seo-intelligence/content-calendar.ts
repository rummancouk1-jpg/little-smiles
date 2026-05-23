// Content calendar engine. Generates a deterministic list of future
// article ideas from real site data — no fake search volume, no invented
// keyword opportunities. Every idea is labelled with the source that
// produced it so the client knows the data behind the suggestion.
//
// Four idea sources:
//
//   1. cluster_coverage         — categories with products but no (or thin)
//                                 editorial coverage. The classic gap-fill.
//   2. product_support          — featured / best-seller products that
//                                 don't have a supporting article. Each
//                                 idea anchors directly on the product.
//   3. internal_linking         — existing posts with no outbound internal
//                                 links to either related blog posts or
//                                 in-stock products in the same category.
//   4. thin_content_expansion   — published posts flagged by the content
//                                 decay engine as too short. The idea is
//                                 to refresh, not write from scratch.
//
// Each idea also ships with a deterministic outline (3-5 H2 headings) and
// 3 suggested FAQ questions, so a writer (or an LLM, manually invoked)
// can move straight from the dashboard to a draft.

import { products, type Product } from "@/lib/products";
import { blogPosts, type BlogPost } from "@/lib/blog";
import type { BlogRelatedProductCategory } from "@/lib/contentops/blog-schema";

const ALL_CATEGORIES: BlogRelatedProductCategory[] = [
  "Bottle Case",
  "Bow Set",
  "Feeding Cushion",
  "Food Container",
  "Swaddle",
  "Bodysuits",
  "Food Bag",
];

const TARGET_LIMIT_DEFAULT = 18;
const TARGET_LIMIT_MIN = 10;

const THIN_POST_WORD_FLOOR = 400;

export type CalendarOpportunityKind =
  | "cluster_coverage"
  | "product_support"
  | "internal_linking"
  | "thin_content_expansion";

export type CalendarSearchIntent =
  | "informational"
  | "commercial"
  | "comparison"
  | "how_to"
  | "faq";

export type ContentCalendarIdea = {
  /** Stable id used in the audit log / dedup checks. Derived from kind + slug-like target. */
  id: string;
  kind: CalendarOpportunityKind;
  /** Friendly label rendered on the card — matches the four source bullets above. */
  kindLabel: string;
  suggestedTitle: string;
  targetCategory: BlogRelatedProductCategory;
  searchIntent: CalendarSearchIntent;
  priority: "high" | "medium" | "low";
  /** One short sentence the operator/client can read to understand WHY this idea exists. */
  whyItMatters: string;
  /** Longer derivation — explains the local data that triggered the idea. */
  reason: string;
  suggestedInternalLinks: string[];
  suggestedProductCta: { slug: string; name: string } | null;
  /** 3-5 H2 headings the writer can use as a deterministic outline. */
  suggestedOutline: string[];
  /** 3 ready-to-use FAQ questions. */
  suggestedFaqs: string[];
  /** When the idea is a refresh of an existing post (kind: thin_content_expansion), this points at it. */
  refreshTargetSlug?: string;
};

export type ContentCalendarReport = {
  generatedAt: string;
  ideas: ContentCalendarIdea[];
  stats: {
    totalIdeas: number;
    highPriority: number;
    weakClusters: BlogRelatedProductCategory[];
    byKind: Record<CalendarOpportunityKind, number>;
  };
  caveat: string;
};

type CategoryCoverage = {
  category: BlogRelatedProductCategory;
  productCount: number;
  blogPostCount: number;
  inStockProductCount: number;
  weakness: "empty" | "weak" | "balanced" | "strong";
};

const KIND_LABELS: Record<CalendarOpportunityKind, string> = {
  cluster_coverage: "Cluster coverage opportunity",
  product_support: "Product support opportunity",
  internal_linking: "Internal linking opportunity",
  thin_content_expansion: "Thin content expansion opportunity",
};

function buildCoverage(): CategoryCoverage[] {
  return ALL_CATEGORIES.map((category) => {
    const productsInCategory = products.filter((p) => p.category === category);
    const productCount = productsInCategory.length;
    const inStockProductCount = productsInCategory.filter((p) => p.inStock).length;
    const blogPostCount = blogPosts.filter((b) => b.relatedProductCategory === category).length;
    let weakness: CategoryCoverage["weakness"];
    if (productCount === 0 && blogPostCount === 0) weakness = "empty";
    else if (blogPostCount === 0) weakness = "weak";
    else if (productCount >= 3 && blogPostCount >= 2) weakness = "strong";
    else weakness = "balanced";
    return { category, productCount, blogPostCount, inStockProductCount, weakness };
  });
}

function priorityForCoverage(c: CategoryCoverage): "high" | "medium" | "low" {
  if (c.weakness === "weak") return "high";
  if (c.weakness === "balanced") return "medium";
  return "low";
}

function anchorProductForCategory(
  category: BlogRelatedProductCategory,
): { slug: string; name: string } | null {
  const inCategory = products.filter((p) => p.category === category);
  const anchor =
    inCategory.find((p) => p.featured && p.inStock) ??
    inCategory.find((p) => p.inStock) ??
    inCategory[0];
  return anchor ? { slug: anchor.slug, name: anchor.name } : null;
}

function existingPostTitlesInCategory(category: BlogRelatedProductCategory): string[] {
  return blogPosts
    .filter((b) => b.relatedProductCategory === category)
    .map((b) => b.title);
}

/** Outline / FAQ templates that read naturally for parent-facing baby retail content. */
function defaultOutline(category: BlogRelatedProductCategory, intent: CalendarSearchIntent): string[] {
  const cat = category;
  const lower = cat.toLowerCase();
  if (intent === "commercial" || intent === "comparison") {
    return [
      `What to look for in a quality ${lower}`,
      `Materials and care: what actually matters`,
      `Common mistakes parents make when buying a ${lower}`,
      `How to choose the right ${lower} for your routine`,
      `Our pick: best ${lower} for Pakistani families`,
    ];
  }
  if (intent === "how_to") {
    return [
      `When to start using a ${lower}`,
      `Step-by-step routine`,
      `Care, cleaning, and longevity`,
      `Signs you need to replace it`,
    ];
  }
  if (intent === "faq") {
    return [
      `Quick answers parents always ask`,
      `Safety and material concerns`,
      `Usage and care`,
      `Gifting and registry questions`,
    ];
  }
  // informational fallback
  return [
    `What is a ${lower}, really?`,
    `Why parents in Pakistan choose ${lower}s`,
    `Care basics every parent should know`,
    `When to use what — practical scenarios`,
  ];
}

function defaultFaqs(category: BlogRelatedProductCategory): string[] {
  const lower = category.toLowerCase();
  return [
    `What age is a ${lower} recommended for?`,
    `How many ${lower}s does a newborn actually need?`,
    `How do I wash and care for a ${lower}?`,
  ];
}

type IdeaTemplate = {
  titlePattern: (category: string) => string;
  intent: CalendarSearchIntent;
  rationale: string;
};

const CLUSTER_TEMPLATES: IdeaTemplate[] = [
  {
    titlePattern: (c) => `${c} Buying Guide: What Actually Matters for Pakistani Parents`,
    intent: "commercial",
    rationale: "Buying-guide format anchors a category cluster.",
  },
  {
    titlePattern: (c) => `How Many ${c}s Does a Newborn Actually Need?`,
    intent: "informational",
    rationale: "High-intent informational query; bridges to product CTAs.",
  },
  {
    titlePattern: (c) => `${c} Care and Cleaning: A Simple Routine`,
    intent: "how_to",
    rationale: "Evergreen care content earns long-tail traffic over time.",
  },
  {
    titlePattern: (c) => `Best ${c} for Pakistani Summers (and Why Fabric Matters)`,
    intent: "commercial",
    rationale: "Localised comparison content competes well against generic listicles.",
  },
  {
    titlePattern: (c) => `${c} vs Alternatives: Which Is Right for Your Routine?`,
    intent: "comparison",
    rationale: "Comparison phrasing surfaces in featured snippets.",
  },
  {
    titlePattern: (c) => `5 Common Questions About ${c}s, Answered`,
    intent: "faq",
    rationale: "FAQ format opens People Also Ask placement.",
  },
];

function isDuplicateTitle(title: string, existing: string[]): boolean {
  const lead = title.toLowerCase().split(":")[0].slice(0, 20);
  return existing.some((e) => e.toLowerCase().includes(lead));
}

function buildClusterIdeas(c: CategoryCoverage): ContentCalendarIdea[] {
  if (c.weakness === "empty") return [];
  const existing = existingPostTitlesInCategory(c.category);
  const anchor = anchorProductForCategory(c.category);
  const priority = priorityForCoverage(c);
  const internalLinks: string[] = [`/shop?category=${c.category}`];
  if (anchor) internalLinks.push(`/shop/${anchor.slug}`);

  const ideas: ContentCalendarIdea[] = [];
  for (const template of CLUSTER_TEMPLATES) {
    const title = template.titlePattern(c.category);
    if (isDuplicateTitle(title, existing)) continue;

    ideas.push({
      id: `cluster::${c.category}::${template.intent}`,
      kind: "cluster_coverage",
      kindLabel: KIND_LABELS.cluster_coverage,
      suggestedTitle: title,
      targetCategory: c.category,
      searchIntent: template.intent,
      priority,
      whyItMatters: `Strengthens the ${c.category} cluster — currently ${c.productCount} product(s) and ${c.blogPostCount} post(s).`,
      reason: `${template.rationale} Cluster weakness: ${c.weakness}.`,
      suggestedInternalLinks: internalLinks.slice(0, 3),
      suggestedProductCta: anchor,
      suggestedOutline: defaultOutline(c.category, template.intent),
      suggestedFaqs: defaultFaqs(c.category),
    });
  }
  return ideas;
}

function buildProductSupportIdeas(): ContentCalendarIdea[] {
  // Products that are featured or best-seller AND in stock AND have no
  // existing post that mentions their slug — we want one explainer per
  // hero product. Limit to two ideas per category to avoid flooding.
  const ideas: ContentCalendarIdea[] = [];
  const perCategoryCount = new Map<string, number>();

  const candidates: Product[] = products
    .filter((p) => p.inStock)
    .filter((p) => p.featured || p.bestSeller)
    .sort((a, b) => {
      const aRank = (a.featured ? 2 : 0) + (a.bestSeller ? 1 : 0);
      const bRank = (b.featured ? 2 : 0) + (b.bestSeller ? 1 : 0);
      return bRank - aRank;
    });

  for (const product of candidates) {
    const alreadyCoveredInBody = blogPosts.some((b) => {
      const text = [
        ...b.sections.flatMap((s) => [s.heading, ...s.content]),
        b.cta.href,
      ].join("\n");
      return text.includes(`/shop/${product.slug}`);
    });
    if (alreadyCoveredInBody) continue;

    const inCat = perCategoryCount.get(product.category) ?? 0;
    if (inCat >= 2) continue;
    perCategoryCount.set(product.category, inCat + 1);

    const category = product.category as BlogRelatedProductCategory;
    ideas.push({
      id: `product_support::${product.slug}`,
      kind: "product_support",
      kindLabel: KIND_LABELS.product_support,
      suggestedTitle: `Why Parents in Pakistan Are Choosing ${product.name}`,
      targetCategory: category,
      searchIntent: "commercial",
      priority: product.featured ? "high" : "medium",
      whyItMatters: `${product.name} is ${product.featured ? "featured" : "a best-seller"} but no published post links to it. A supporting article gives the product a content path to organic traffic.`,
      reason: `Anchor product for category "${product.category}" with no body-text reference in any existing blog post.`,
      suggestedInternalLinks: [`/shop/${product.slug}`, `/shop?category=${product.category}`],
      suggestedProductCta: { slug: product.slug, name: product.name },
      suggestedOutline: [
        `What parents look for in a ${product.category.toLowerCase()}`,
        `Why ${product.name} stands out — materials and design`,
        `How to use ${product.name} day-to-day`,
        `Care and cleaning`,
        `Where to buy and what to expect`,
      ],
      suggestedFaqs: [
        `Is ${product.name} suitable for newborns?`,
        `How do I care for ${product.name}?`,
        `What sizes / variants does ${product.name} come in?`,
      ],
    });
  }
  return ideas;
}

function buildInternalLinkingIdeas(): ContentCalendarIdea[] {
  // Posts whose body text contains NO internal links to either a blog or
  // a product slug. Each such post becomes one "internal linking" idea —
  // it represents a post that would benefit from a follow-up or refresh
  // adding the missing anchors.
  const ideas: ContentCalendarIdea[] = [];
  const seen = new Set<string>();

  for (const post of blogPosts) {
    const text = [
      ...post.sections.flatMap((s) => [s.heading, ...s.content]),
      post.cta.href,
    ].join("\n");
    const hasInternal = /\/(shop|blog)\/[A-Za-z0-9_-]+/.test(text);
    if (hasInternal) continue;
    if (seen.has(post.slug)) continue;
    seen.add(post.slug);

    const category = post.relatedProductCategory as BlogRelatedProductCategory;
    const anchor = anchorProductForCategory(category);
    ideas.push({
      id: `internal_link::${post.slug}`,
      kind: "internal_linking",
      kindLabel: KIND_LABELS.internal_linking,
      suggestedTitle: `Refresh "${post.title}" with internal links and product anchors`,
      targetCategory: category,
      searchIntent: "informational",
      priority: "medium",
      whyItMatters: `"${post.title}" currently has no outbound internal links. Adding 1-2 anchors strengthens the topical cluster and helps the page rank for adjacent queries.`,
      reason: `Post body contains no /shop/<slug> or /blog/<slug> references.`,
      suggestedInternalLinks: anchor
        ? [`/shop/${anchor.slug}`, `/shop?category=${category}`]
        : [`/shop?category=${category}`],
      suggestedProductCta: anchor,
      suggestedOutline: [
        `Add an "Our recommendation" paragraph inside an existing section`,
        `Add a product anchor link with the recommended sentence below`,
        `Add a follow-up "Read next" link to the most related blog post`,
        `Verify the CTA href ends with /shop?category=${category}`,
      ],
      suggestedFaqs: [
        `Which product in this category is the safest bet for new parents?`,
        `What related guides should I read after this article?`,
        `How does this article fit into the wider ${category} cluster?`,
      ],
      refreshTargetSlug: post.slug,
    });
  }
  return ideas;
}

function buildThinExpansionIdeas(): ContentCalendarIdea[] {
  // Posts whose word count is below the floor — turn each into a
  // "refresh / expand" idea, not a new post idea.
  const ideas: ContentCalendarIdea[] = [];
  for (const post of blogPosts) {
    const wordCount = post.sections.reduce(
      (sum, s) => sum + s.content.reduce((sub, p) => sub + p.trim().split(/\s+/).filter(Boolean).length, 0),
      0,
    );
    if (wordCount >= THIN_POST_WORD_FLOOR) continue;

    const category = post.relatedProductCategory as BlogRelatedProductCategory;
    const anchor = anchorProductForCategory(category);
    ideas.push({
      id: `thin_expansion::${post.slug}`,
      kind: "thin_content_expansion",
      kindLabel: KIND_LABELS.thin_content_expansion,
      suggestedTitle: `Expand "${post.title}" to 700-1200 words`,
      targetCategory: category,
      searchIntent: "informational",
      priority: wordCount < THIN_POST_WORD_FLOOR / 2 ? "high" : "medium",
      whyItMatters: `"${post.title}" is currently ${wordCount} words — Google often demotes thin content under 400 words. Expanding it is faster and safer than writing a new piece.`,
      reason: `Word count ${wordCount} is below the ${THIN_POST_WORD_FLOOR}-word floor.`,
      suggestedInternalLinks: anchor
        ? [`/shop/${anchor.slug}`, `/shop?category=${category}`]
        : [`/shop?category=${category}`],
      suggestedProductCta: anchor,
      suggestedOutline: [
        `Add a "Common mistakes parents make" section`,
        `Add a "How to choose" decision section`,
        `Add a "Care and cleaning" routine section`,
        `Add an FAQ block with 3-5 questions`,
        `Add a clear closing CTA paragraph above the existing CTA`,
      ],
      suggestedFaqs: defaultFaqs(category),
      refreshTargetSlug: post.slug,
    });
  }
  return ideas;
}

function emptyByKind(): Record<CalendarOpportunityKind, number> {
  return {
    cluster_coverage: 0,
    product_support: 0,
    internal_linking: 0,
    thin_content_expansion: 0,
  };
}

const PRIORITY_RANK: Record<"high" | "medium" | "low", number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const KIND_RANK: Record<CalendarOpportunityKind, number> = {
  // Cluster gaps usually have the most upside; product support is next;
  // internal-linking / thin-content are essential but smaller per-idea.
  cluster_coverage: 0,
  product_support: 1,
  internal_linking: 2,
  thin_content_expansion: 3,
};

export function buildContentCalendarReport(limit = TARGET_LIMIT_DEFAULT): ContentCalendarReport {
  const targetLimit = Math.max(limit, TARGET_LIMIT_MIN);
  const coverage = buildCoverage();
  const weakClusters = coverage
    .filter((c) => c.weakness === "weak" || c.weakness === "balanced")
    .map((c) => c.category);

  const allIdeas: ContentCalendarIdea[] = [];

  // 1. Cluster coverage — go category-by-category, weakest first.
  const sortedCoverage = [...coverage].sort((a, b) => {
    const rank: Record<CategoryCoverage["weakness"], number> = {
      weak: 0,
      balanced: 1,
      empty: 2,
      strong: 3,
    };
    return rank[a.weakness] - rank[b.weakness];
  });
  for (const c of sortedCoverage) {
    allIdeas.push(...buildClusterIdeas(c));
  }

  // 2. Product support — anchor articles for featured / best-seller products.
  allIdeas.push(...buildProductSupportIdeas());

  // 3. Internal linking — refresh posts with no outbound internal links.
  allIdeas.push(...buildInternalLinkingIdeas());

  // 4. Thin content expansion — refresh posts under the word floor.
  allIdeas.push(...buildThinExpansionIdeas());

  // Dedupe by id — defensive; the generators should already be disjoint.
  const seen = new Set<string>();
  const deduped: ContentCalendarIdea[] = [];
  for (const idea of allIdeas) {
    if (seen.has(idea.id)) continue;
    seen.add(idea.id);
    deduped.push(idea);
  }

  // Sort: high priority first, then by kind rank (cluster → product → link → thin).
  deduped.sort((a, b) => {
    const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (p !== 0) return p;
    return KIND_RANK[a.kind] - KIND_RANK[b.kind];
  });

  const trimmed = deduped.slice(0, targetLimit);

  const byKind = emptyByKind();
  for (const idea of trimmed) byKind[idea.kind] += 1;

  return {
    generatedAt: new Date().toISOString(),
    ideas: trimmed,
    stats: {
      totalIdeas: trimmed.length,
      highPriority: trimmed.filter((i) => i.priority === "high").length,
      weakClusters,
      byKind,
    },
    caveat:
      "These ideas are derived from local catalog + blog + link-graph data. They are NOT search-volume opportunities — no external keyword tool was consulted. Each idea is labelled with its source so client expectations stay calibrated.",
  };
}

export function countWeakClusters(): number {
  return buildCoverage().filter((c) => c.weakness === "weak" || c.weakness === "balanced").length;
}

export type { BlogPost };
