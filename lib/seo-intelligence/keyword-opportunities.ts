// Keyword Opportunities Foundation v1.
//
// LIGHTWEIGHT engine that surfaces keyword-shaped opportunities derived
// strictly from local site data — never from external APIs, scraping, or
// estimated search volume. The goal is to give the operator a single
// place to triage "what should we write / refresh / link next?" without
// pretending we know what Google ranks today.
//
// Sources used (all already computed elsewhere in this codebase):
//
//   1. Local cluster gaps   — categories with weak editorial coverage.
//                              Re-uses content-calendar's coverage logic.
//   2. Content gaps         — featured / best-seller products with no
//                              supporting blog post (product-support ideas).
//   3. Thin content         — existing posts under the word-count floor
//                              flagged by the calendar's thin-expansion bin.
//   4. Internal-link gaps   — posts with no outbound internal links.
//   5. Manual               — reserved type; nothing emitted yet. The
//                              workflow for hand-adding opportunities is
//                              an admin UI form in v2.
//
// Each opportunity has a status field that supports the full lifecycle
// (idea / approved / drafted / published), but v1 ONLY derives idea /
// drafted / published from local repo state. "approved" requires
// persistence (Supabase table) — out of scope for v1. We surface the
// shape so v2 can layer it in without breaking the type.
//
// NO external keyword data is consulted. NO fake volume / CPC / difficulty
// is invented. Every priority + reason is traceable to a local signal.

import { blogPosts } from "@/lib/blog";
import type { BlogRelatedProductCategory } from "@/lib/contentops/blog-schema";
import { listDrafts, type Draft } from "@/lib/contentops/drafts-store";

import {
  buildContentCalendarReport,
  type ContentCalendarIdea,
} from "@/lib/seo-intelligence/content-calendar";

export type KeywordOpportunitySource =
  | "local_cluster"
  | "content_gap"
  | "thin_content"
  | "internal_link_gap"
  | "manual"
  | "future_gsc"
  | "future_api";

export type KeywordOpportunityIntent =
  | "informational"
  | "commercial"
  | "comparison"
  | "how_to"
  | "faq";

export type KeywordOpportunityPriority = "low" | "medium" | "high";

export type KeywordOpportunityStatus = "idea" | "approved" | "drafted" | "published";

export type KeywordOpportunity = {
  /** Stable id — used for audit logs and (future) status persistence. */
  id: string;
  /** The keyword / phrase the opportunity targets. Always lowercase. */
  keyword: string;
  intent: KeywordOpportunityIntent;
  /**
   * What the keyword targets. Either a blog category (cluster-level) or a
   * specific product (product-support). Always one of `targetCategory` or
   * `targetProductSlug` is set.
   */
  targetCategory: BlogRelatedProductCategory | null;
  targetProductSlug: string | null;
  targetProductName: string | null;
  source: KeywordOpportunitySource;
  priority: KeywordOpportunityPriority;
  status: KeywordOpportunityStatus;
  /** Why this is in the list — one sentence, derived from local data. */
  reason: string;
  /** Proposed article title (shareable with the writer). */
  suggestedTitle: string;
  /** Internal links the article should include (`/shop/...`, `/blog/...`). */
  suggestedInternalLinks: string[];
  /** Proposed CTA. Always points to /shop?category=... — same convention as live posts. */
  suggestedCta: { label: string; href: string };
  /** Outline H2s — small, deterministic, copy-ready. */
  suggestedOutline: string[];
  /** 3 FAQ questions. */
  suggestedFaqs: string[];
  /** When status is drafted/published, which draft / post id it links to. */
  linkedDraftId?: string;
  linkedDraftSlug?: string;
  linkedPostSlug?: string;
};

export type KeywordOpportunityStats = {
  totalIdeas: number;
  byPriority: Record<KeywordOpportunityPriority, number>;
  byStatus: Record<KeywordOpportunityStatus, number>;
  bySource: Record<KeywordOpportunitySource, number>;
};

export type KeywordOpportunityReport = {
  generatedAt: string;
  opportunities: KeywordOpportunity[];
  stats: KeywordOpportunityStats;
  caveat: string;
};

// ─── Keyword extraction ─────────────────────────────────────────────────

function normalizeKeyword(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

function categoryKeyword(category: BlogRelatedProductCategory, suffix: string): string {
  return normalizeKeyword(`${category} ${suffix}`);
}

// ─── Status derivation ──────────────────────────────────────────────────

/**
 * Build an index of all existing keywords already covered in the live blog
 * or in active drafts. Lets us flip an opportunity from "idea" to
 * "drafted" or "published" without persistence.
 */
function buildCoverageIndex(drafts: Draft[]): {
  publishedByKeyword: Map<string, string>; // keyword → slug
  draftedByKeyword: Map<string, { id: string; slug: string }>;
} {
  const publishedByKeyword = new Map<string, string>();
  for (const post of blogPosts) {
    for (const kw of post.keywords) {
      publishedByKeyword.set(normalizeKeyword(kw), post.slug);
    }
  }
  const draftedByKeyword = new Map<string, { id: string; slug: string }>();
  for (const draft of drafts) {
    for (const kw of draft.content.keywords) {
      const key = normalizeKeyword(kw);
      // Don't overwrite a published mapping; a published post wins.
      if (publishedByKeyword.has(key)) continue;
      if (!draftedByKeyword.has(key)) {
        draftedByKeyword.set(key, { id: draft.id, slug: draft.slug });
      }
    }
  }
  return { publishedByKeyword, draftedByKeyword };
}

function deriveStatus(
  keyword: string,
  index: ReturnType<typeof buildCoverageIndex>,
): {
  status: KeywordOpportunityStatus;
  linkedPostSlug?: string;
  linkedDraftId?: string;
  linkedDraftSlug?: string;
} {
  const published = index.publishedByKeyword.get(keyword);
  if (published) return { status: "published", linkedPostSlug: published };
  const drafted = index.draftedByKeyword.get(keyword);
  if (drafted) return { status: "drafted", linkedDraftId: drafted.id, linkedDraftSlug: drafted.slug };
  return { status: "idea" };
}

// ─── Builders per source ────────────────────────────────────────────────

function ctaFor(category: BlogRelatedProductCategory): { label: string; href: string } {
  return {
    label: `Explore ${category}`,
    href: `/shop?category=${category}`,
  };
}

/**
 * The content-calendar engine already does the hard work of producing
 * local-data-derived ideas (cluster gaps, product support, internal-link
 * gaps, thin expansion). We don't duplicate it — we lift its ideas and
 * map each into a keyword-shaped opportunity, attaching a derived
 * `keyword` field per kind.
 */
function calendarIdeaToOpportunity(
  idea: ContentCalendarIdea,
  index: ReturnType<typeof buildCoverageIndex>,
): KeywordOpportunity | null {
  // Each idea kind maps to a different source + a different keyword choice.
  let source: KeywordOpportunitySource;
  let keyword: string;
  let targetProductSlug: string | null = null;
  let targetProductName: string | null = null;

  switch (idea.kind) {
    case "cluster_coverage": {
      source = "local_cluster";
      // Pick a keyword that mirrors a real searcher query for the category
      // — but keep it phrased as a topic, not a fabricated long-tail.
      keyword = categoryKeyword(idea.targetCategory, intentSuffix(idea.searchIntent));
      break;
    }
    case "product_support": {
      source = "content_gap";
      if (idea.suggestedProductCta) {
        targetProductSlug = idea.suggestedProductCta.slug;
        targetProductName = idea.suggestedProductCta.name;
        // The keyword for a product-support article is the product name —
        // honest representation of what the article is anchored on.
        keyword = normalizeKeyword(idea.suggestedProductCta.name);
      } else {
        keyword = categoryKeyword(idea.targetCategory, "guide");
      }
      break;
    }
    case "internal_linking": {
      source = "internal_link_gap";
      // Internal-link refresh isn't a new keyword — it's "this published
      // post needs internal anchors." We keep the post's own keyword
      // hooks so the opportunity is dedupe-able and rightly maps to
      // "published" status.
      const post = blogPosts.find((b) => b.slug === idea.refreshTargetSlug);
      keyword = normalizeKeyword(post?.keywords[0] ?? `${idea.targetCategory} internal linking`);
      break;
    }
    case "thin_content_expansion": {
      source = "thin_content";
      const post = blogPosts.find((b) => b.slug === idea.refreshTargetSlug);
      keyword = normalizeKeyword(post?.keywords[0] ?? `${idea.targetCategory} guide`);
      break;
    }
    default:
      return null;
  }

  const statusInfo = deriveStatus(keyword, index);

  // Cluster gaps default to "idea" even if the keyword string happens to
  // appear in another post's keyword list — they specifically represent a
  // cluster that needs MORE coverage, so do not auto-mark as published.
  // The other kinds are happy to honour the derived status.
  let status: KeywordOpportunityStatus = statusInfo.status;
  if (idea.kind === "cluster_coverage" && status === "published") {
    status = "idea";
  }

  return {
    id: `${source}::${idea.id}`,
    keyword,
    intent: mapIntent(idea.searchIntent),
    targetCategory: idea.targetCategory,
    targetProductSlug,
    targetProductName,
    source,
    priority: idea.priority,
    status,
    reason: idea.reason,
    suggestedTitle: idea.suggestedTitle,
    suggestedInternalLinks: idea.suggestedInternalLinks,
    suggestedCta: ctaFor(idea.targetCategory),
    suggestedOutline: idea.suggestedOutline,
    suggestedFaqs: idea.suggestedFaqs,
    linkedDraftId: statusInfo.linkedDraftId,
    linkedDraftSlug: statusInfo.linkedDraftSlug,
    linkedPostSlug: statusInfo.linkedPostSlug,
  };
}

function intentSuffix(intent: ContentCalendarIdea["searchIntent"]): string {
  switch (intent) {
    case "commercial":
      return "buying guide";
    case "comparison":
      return "comparison";
    case "how_to":
      return "how to";
    case "faq":
      return "faq";
    case "informational":
    default:
      return "guide";
  }
}

function mapIntent(
  intent: ContentCalendarIdea["searchIntent"],
): KeywordOpportunityIntent {
  return intent;
}

// ─── Public entry point ─────────────────────────────────────────────────

const CAVEAT =
  "Keyword Opportunities v1 uses local site data only — catalog, blog posts, internal-link graph, and draft state. No external keyword volume, CPC, difficulty, or trend data is fetched. Status is derived: 'drafted' / 'published' come from real repo + draft state; 'approved' requires opt-in persistence (v2). Advanced keyword research can be connected later.";

export async function buildKeywordOpportunityReport(): Promise<KeywordOpportunityReport> {
  // Pull the largest possible candidate set from the calendar engine.
  // The calendar already dedupes and prioritises.
  const calendar = buildContentCalendarReport(60);

  // Drafts inform "drafted" status without persistence.
  const [pending, approved] = await Promise.all([
    listDrafts("pending_review").catch(() => [] as Draft[]),
    listDrafts("approved").catch(() => [] as Draft[]),
  ]);
  const activeDrafts: Draft[] = [...pending, ...approved];
  const index = buildCoverageIndex(activeDrafts);

  const opportunities: KeywordOpportunity[] = [];
  const seenIds = new Set<string>();
  for (const idea of calendar.ideas) {
    const op = calendarIdeaToOpportunity(idea, index);
    if (!op) continue;
    if (seenIds.has(op.id)) continue;
    seenIds.add(op.id);
    opportunities.push(op);
  }

  // Deterministic sort: high-priority idea first, then medium, then low.
  // Drafted/published opportunities push to the bottom — operators want
  // to act on idea-stage rows first.
  const STATUS_RANK: Record<KeywordOpportunityStatus, number> = {
    idea: 0,
    approved: 1,
    drafted: 2,
    published: 3,
  };
  const PRIORITY_RANK: Record<KeywordOpportunityPriority, number> = {
    high: 0,
    medium: 1,
    low: 2,
  };
  opportunities.sort((a, b) => {
    const s = STATUS_RANK[a.status] - STATUS_RANK[b.status];
    if (s !== 0) return s;
    const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (p !== 0) return p;
    return a.suggestedTitle.localeCompare(b.suggestedTitle);
  });

  const stats: KeywordOpportunityStats = {
    totalIdeas: opportunities.length,
    byPriority: { high: 0, medium: 0, low: 0 },
    byStatus: { idea: 0, approved: 0, drafted: 0, published: 0 },
    bySource: {
      local_cluster: 0,
      content_gap: 0,
      thin_content: 0,
      internal_link_gap: 0,
      manual: 0,
      future_gsc: 0,
      future_api: 0,
    },
  };
  for (const op of opportunities) {
    stats.byPriority[op.priority] += 1;
    stats.byStatus[op.status] += 1;
    stats.bySource[op.source] += 1;
  }

  return {
    generatedAt: new Date().toISOString(),
    opportunities,
    stats,
    caveat: CAVEAT,
  };
}

// ─── Content brief generator ────────────────────────────────────────────

/**
 * Build a copy-ready content brief for an opportunity. Pure function —
 * same inputs always produce the same string. Designed to be pasted into
 * the writer's tool of choice (email, Notion, Claude, ChatGPT).
 */
export function buildContentBrief(op: KeywordOpportunity): string {
  const intentLabel = intentDisplay(op.intent);
  const target = op.targetProductName
    ? `Product: ${op.targetProductName} (/shop/${op.targetProductSlug})`
    : op.targetCategory
      ? `Category: ${op.targetCategory} (/shop?category=${op.targetCategory})`
      : "—";

  const linkLines =
    op.suggestedInternalLinks.length > 0
      ? op.suggestedInternalLinks.map((l) => `  - ${l}`).join("\n")
      : "  (none yet — add 1–2 cluster anchors before publishing)";

  const outlineLines =
    op.suggestedOutline.length > 0
      ? op.suggestedOutline.map((h, i) => `  ${i + 1}. ${h}`).join("\n")
      : "  (no outline)";

  const faqLines =
    op.suggestedFaqs.length > 0
      ? op.suggestedFaqs.map((q) => `  - ${q}`).join("\n")
      : "  (none)";

  return [
    `Little Smiles — Content brief`,
    ``,
    `Keyword:           ${op.keyword}`,
    `Search intent:     ${intentLabel}`,
    `Suggested title:   ${op.suggestedTitle}`,
    `Target:            ${target}`,
    `Source signal:     ${sourceDisplay(op.source)}`,
    `Priority:          ${op.priority.toUpperCase()}`,
    `Status:            ${op.status}`,
    ``,
    `Why this is on the list`,
    `-----------------------`,
    `${op.reason}`,
    ``,
    `Suggested outline (H2s)`,
    `-----------------------`,
    outlineLines,
    ``,
    `FAQ ideas`,
    `---------`,
    faqLines,
    ``,
    `Internal links to include`,
    `-------------------------`,
    linkLines,
    ``,
    `CTA`,
    `---`,
    `  Label: ${op.suggestedCta.label}`,
    `  Href:  ${op.suggestedCta.href}`,
    ``,
    `Honest disclosure`,
    `-----------------`,
    `This brief was generated from local site data only — no external keyword volume, CPC, or difficulty was consulted. Treat the keyword as a topical hook, not a ranked search-volume guarantee.`,
  ].join("\n");
}

function intentDisplay(intent: KeywordOpportunityIntent): string {
  switch (intent) {
    case "informational":
      return "Informational (researching)";
    case "commercial":
      return "Commercial (ready to compare / buy)";
    case "comparison":
      return "Comparison (X vs Y)";
    case "how_to":
      return "How-to (task-oriented)";
    case "faq":
      return "FAQ (short-answer queries)";
  }
}

function sourceDisplay(source: KeywordOpportunitySource): string {
  switch (source) {
    case "local_cluster":
      return "Local cluster gap (category needs more editorial coverage)";
    case "content_gap":
      return "Content gap (featured/best-seller product has no supporting article)";
    case "thin_content":
      return "Thin content (existing post is below the word-count floor)";
    case "internal_link_gap":
      return "Internal-link gap (existing post has no outbound internal links)";
    case "manual":
      return "Manual (added by operator)";
    case "future_gsc":
      return "Search Console (future — not wired in v1)";
    case "future_api":
      return "External keyword API (future — not wired in v1)";
  }
}

/** Stable display label per priority. */
export function priorityDisplay(p: KeywordOpportunityPriority): string {
  return p.charAt(0).toUpperCase() + p.slice(1);
}

/** Stable display label per status. */
export function statusDisplay(s: KeywordOpportunityStatus): string {
  if (s === "idea") return "Idea";
  if (s === "approved") return "Approved";
  if (s === "drafted") return "Drafted";
  return "Published";
}
