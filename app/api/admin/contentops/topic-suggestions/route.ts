import { NextResponse } from "next/server";

import { isAuthorizedAdminRequest } from "@/lib/admin-auth";
import { generateParentQuestions } from "@/lib/contentops/topic-question";
import {
  SUGGESTIONS_DISCLOSURE,
  SUGGESTIONS_RANKING_NOTE,
  getRankedUncoveredOpportunities,
} from "@/lib/contentops/topic-suggestions";
import { captureServerError } from "@/lib/error-observability";
import { normalizeKeyword } from "@/lib/seo-intelligence/keyword-opportunities";

// May call Haiku (question phrasing) + hits Supabase/blog data — run on Node.
// The cache makes a warm request instant; a cold one is one small batched call.
export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: Request) {
  if (!isAuthorizedAdminRequest(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const ranked = await getRankedUncoveredOpportunities(8);
    const questions = await generateParentQuestions(
      ranked.map((r) => ({ keyword: r.keyword, intent: r.intent })),
    );
    const suggestions = ranked.map((r) => ({
      keyword: r.keyword,
      // Fall back to the engine's suggested title if phrasing somehow missed it.
      question: questions.get(normalizeKeyword(r.keyword)) ?? r.suggestedTitle,
      priority: r.priority,
      intent: r.intent,
    }));

    return NextResponse.json({
      ok: true,
      suggestions,
      rankingNote: SUGGESTIONS_RANKING_NOTE,
      disclosure: SUGGESTIONS_DISCLOSURE,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load topic suggestions";
    captureServerError(
      "api_admin_contentops_topic_suggestions_failed",
      err instanceof Error ? err : new Error(message),
    );
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
