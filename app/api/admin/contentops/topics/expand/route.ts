// Autonomous topic expansion endpoint. Given a draft id, the route:
//   1. Loads the draft + all topics + all blog articles.
//   2. Runs the deterministic topic-expansion engine to derive 4–6
//      follow-up suggestions.
//   3. Creates topic rows for each suggestion that's not already in
//      the queue or already a published article title.
//   4. Audits the operation with the list of created titles.
//
// The route is idempotent under retry: createTopic uses the unique
// (title) index in Supabase, so a re-run won't double-insert.

import { NextResponse } from "next/server";
import { z } from "zod";

import { isAuthorizedAdminRequest } from "@/lib/admin-auth";
import { logAdminAudit } from "@/lib/admin-audit";
import { getAllBlogPosts } from "@/lib/blog";
import { getDraftById } from "@/lib/contentops/drafts-store";
import { suggestExpansionTopics } from "@/lib/contentops/intelligence/topic-expansion";
import {
  createTopic,
  listTopics,
  type Topic,
  type TopicalCluster,
} from "@/lib/contentops/topics-store";
import { captureServerError } from "@/lib/error-observability";

export const maxDuration = 30;

const bodySchema = z.object({
  draftId: z.string().uuid(),
  /** Default 5; capped at 8 by the engine. */
  limit: z.number().int().min(1).max(8).optional(),
  /**
   * When true, the route only returns the suggestions without
   * persisting any rows. Useful for the operator preview step.
   */
  dryRun: z.boolean().optional(),
});

export async function POST(request: Request) {
  if (!isAuthorizedAdminRequest(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid expansion payload" },
      { status: 400 },
    );
  }

  let draft;
  try {
    draft = await getDraftById(parsed.data.draftId);
  } catch (err) {
    captureServerError(
      "api_admin_contentops_topic_expansion_read_failed",
      err instanceof Error ? err : new Error(String(err)),
      { draftId: parsed.data.draftId },
    );
    return NextResponse.json(
      { ok: false, error: "Failed to read draft" },
      { status: 500 },
    );
  }
  if (!draft) {
    return NextResponse.json({ ok: false, error: "Draft not found" }, { status: 404 });
  }

  // Best-effort context loads. Failures degrade to "no dedupe" rather
  // than failing the whole operation — duplicates would still be
  // refused by the unique title index downstream.
  const [existingTopicsRaw, allArticles] = await Promise.all([
    listTopics().catch(() => [] as Topic[]),
    getAllBlogPosts().catch(() => []),
  ]);

  const suggestions = suggestExpansionTopics({
    article: draft.content,
    existingTopicTitles: existingTopicsRaw.map((t) => t.title),
    existingArticleTitles: allArticles.map((a) => a.title),
    limit: parsed.data.limit,
  });

  if (parsed.data.dryRun) {
    return NextResponse.json({ ok: true, suggestions, created: [] });
  }

  // Persist. createTopic throws on schema or unique-violation errors;
  // we collect them per-row so a single duplicate doesn't abort the
  // batch.
  const created: Array<{ id: string; title: string }> = [];
  const skipped: Array<{ title: string; reason: string }> = [];
  for (const s of suggestions) {
    try {
      const row = await createTopic({
        title: s.title,
        intent: s.intent,
        related_category: draft.content.relatedProductCategory,
        priority: "medium",
        seasonality: s.seasonality,
        format: s.format,
        cluster: s.cluster as TopicalCluster,
      });
      created.push({ id: row.id, title: row.title });
    } catch (err) {
      skipped.push({
        title: s.title,
        reason: err instanceof Error ? err.message : "unknown",
      });
    }
  }

  await logAdminAudit(request, {
    action: "contentops_topic_expansion",
    targetType: "contentops_draft",
    targetId: parsed.data.draftId,
    metadata: {
      sourceSlug: draft.content.slug,
      requested: suggestions.length,
      createdCount: created.length,
      skippedCount: skipped.length,
      createdTitles: created.map((c) => c.title),
    },
  });

  return NextResponse.json({
    ok: true,
    suggestions,
    created,
    skipped,
  });
}
