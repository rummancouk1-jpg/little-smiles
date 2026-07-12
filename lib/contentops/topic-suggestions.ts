// Topic suggestions for the ContentOps "Generate a new draft" form.
//
// Surfaces UNCOVERED keyword opportunities (topics not yet written about) so the
// operator picks a gap-filling topic instead of typing from scratch. Reuses the
// existing keyword-opportunity engine + coverage derivation — it does NOT invent
// a second keyword source.
//
// Honest by construction: the underlying data is local site signals (catalog,
// posts, drafts, internal-link graph). There is NO measured search volume or
// difficulty, so ranking is by local content-gap PRIORITY + intent only, and
// the UI must say so (see SUGGESTIONS_* copy below). We never imply traffic.

import {
  buildCompleteCoveredKeywordSet,
  buildKeywordOpportunityReport,
  normalizeKeyword,
  type KeywordOpportunityIntent,
  type KeywordOpportunityPriority,
} from "@/lib/seo-intelligence/keyword-opportunities";

/** A ranked, uncovered opportunity ready to become a suggestion (question added
 *  separately by the phrasing step). */
export type RankedOpportunity = {
  keyword: string;
  intent: KeywordOpportunityIntent;
  priority: KeywordOpportunityPriority;
  /** The engine's proposed article title — used as a safe question fallback. */
  suggestedTitle: string;
};

const PRIORITY_RANK: Record<KeywordOpportunityPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

// Buyer-leaning intent order — commercial/comparison/how-to tend to be the most
// useful gap-fillers; informational + faq follow. A local heuristic, NOT a
// volume judgement.
const INTENT_RANK: Record<KeywordOpportunityIntent, number> = {
  commercial: 0,
  comparison: 1,
  how_to: 2,
  informational: 3,
  faq: 4,
};

/**
 * Ranked, uncovered topic opportunities. Primary filter: status === "idea"
 * (reuses deriveStatus) AND not present in the COMPLETE covered-keyword set
 * (getAllBlogPosts incl. admin-published + pending/approved drafts) — so a
 * suggestion can never collide with any existing or in-flight post. Secondary
 * rank: local priority, then intent, then title. Returns at most `limit`.
 */
export async function getRankedUncoveredOpportunities(limit = 8): Promise<RankedOpportunity[]> {
  const [report, covered] = await Promise.all([
    buildKeywordOpportunityReport(),
    buildCompleteCoveredKeywordSet(),
  ]);

  const seen = new Set<string>();
  const uncovered = report.opportunities.filter((op) => {
    if (op.status !== "idea") return false; // only genuinely uncovered ideas
    const key = normalizeKeyword(op.keyword);
    if (covered.has(key)) return false; // complete-coverage guard (incl. admin-published DB posts)
    if (seen.has(key)) return false; // de-dupe identical keywords across sources
    seen.add(key);
    return true;
  });

  uncovered.sort((a, b) => {
    const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (p !== 0) return p;
    const i = INTENT_RANK[a.intent] - INTENT_RANK[b.intent];
    if (i !== 0) return i;
    return a.suggestedTitle.localeCompare(b.suggestedTitle);
  });

  return uncovered.slice(0, Math.max(1, Math.min(limit, 12))).map((op) => ({
    keyword: op.keyword,
    intent: op.intent,
    priority: op.priority,
    suggestedTitle: op.suggestedTitle,
  }));
}

/** Short in-context note on how these are ranked — must not imply search volume. */
export const SUGGESTIONS_RANKING_NOTE =
  "Ranked by local content-gap priority, not measured search volume.";

/** Fuller honest disclosure for the suggestions panel. */
export const SUGGESTIONS_DISCLOSURE =
  "Uncovered topics from your own site data (catalog, posts, drafts) — gaps you haven't written about yet. Ranking reflects local content-gap priority + intent, not search-volume or traffic estimates.";
