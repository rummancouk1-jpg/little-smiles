// Topic-driven draft generation. Wraps the same generateDraftFromTopic
// helper the /drafts/generate route uses, then links the resulting
// draft back to the topic in a single transactional flow.
//
// Prevents duplicate active drafts from the same topic via the
// linkTopicToDraft SQL-level guard (requires topic.status='queued').
// If the topic has moved past queued (archived, already drafted), the
// route returns 400 with a clear message before any tokens are spent.

import { NextResponse } from "next/server";

import { isAuthorizedAdminRequest } from "@/lib/admin-auth";
import { logAdminAudit } from "@/lib/admin-audit";
import { generateDraftFromTopic } from "@/lib/contentops/draft-generation";
import { getTopicById, linkTopicToDraft } from "@/lib/contentops/topics-store";
import { captureServerError } from "@/lib/error-observability";

export const maxDuration = 60;

type RouteProps = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: RouteProps) {
  if (!isAuthorizedAdminRequest(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Pre-flight: confirm topic exists and is queued. Avoids paying for
  // an Anthropic call we'd refuse to persist.
  let topic;
  try {
    topic = await getTopicById(id);
  } catch (err) {
    captureServerError(
      "api_admin_contentops_topic_generate_read_failed",
      err instanceof Error ? err : new Error(String(err)),
      { topicId: id },
    );
    return NextResponse.json(
      { ok: false, error: "Failed to read topic" },
      { status: 500 },
    );
  }
  if (!topic) {
    return NextResponse.json({ ok: false, error: "Topic not found" }, { status: 404 });
  }
  if (topic.status !== "queued") {
    return NextResponse.json(
      {
        ok: false,
        error: `Topic is ${topic.status}, not queued. Only queued topics can generate a draft.`,
      },
      { status: 400 },
    );
  }

  let draftResult;
  try {
    draftResult = await generateDraftFromTopic(topic.title);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    captureServerError(
      "api_admin_contentops_topic_generate_failed",
      err instanceof Error ? err : new Error(message),
      { topicId: id, title: topic.title },
    );
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }

  // Link topic to the new draft. If linking fails (e.g., the topic
  // moved past queued via a concurrent action), the draft still exists
  // — it just won't be associated. We surface the link error so the
  // operator can manually reconcile, but the draft is already in the
  // queue and reachable from the editorial surface.
  try {
    await linkTopicToDraft(topic.id, draftResult.id);
  } catch (linkErr) {
    captureServerError(
      "api_admin_contentops_topic_link_failed",
      linkErr instanceof Error ? linkErr : new Error(String(linkErr)),
      { topicId: id, draftId: draftResult.id },
    );
    // Don't fail the outer request — the operator's primary intent
    // (generate the draft) succeeded. Surface the linking warning in
    // the response so the UI can show a hint.
    await logAdminAudit(request, {
      action: "contentops_topic_draft_generated",
      targetType: "contentops_topic",
      targetId: topic.id,
      metadata: {
        title: topic.title,
        draftId: draftResult.id,
        slug: draftResult.slug,
        linkWarning: linkErr instanceof Error ? linkErr.message : String(linkErr),
      },
    });
    return NextResponse.json({
      ok: true,
      draft: draftResult,
      topicLinkWarning:
        "The draft was created but couldn't be linked to this topic. Check the queue.",
    });
  }

  await logAdminAudit(request, {
    action: "contentops_topic_draft_generated",
    targetType: "contentops_topic",
    targetId: topic.id,
    metadata: {
      title: topic.title,
      draftId: draftResult.id,
      slug: draftResult.slug,
    },
  });

  return NextResponse.json({ ok: true, draft: draftResult });
}
