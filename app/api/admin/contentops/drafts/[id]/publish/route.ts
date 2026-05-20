import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { isAuthorizedAdminRequest } from "@/lib/admin-auth";
import { logAdminAudit } from "@/lib/admin-audit";
import { markDraftPublished } from "@/lib/contentops/drafts-store";
import { notifyDraftPublished } from "@/lib/contentops/topics-store";
import { captureServerError } from "@/lib/error-observability";

const publishSchema = z.object({
  notes: z.string().max(2000).optional(),
});

type RouteProps = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: RouteProps) {
  if (!isAuthorizedAdminRequest(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    json = {};
  }

  const parsed = publishSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  try {
    const draft = await markDraftPublished(id, parsed.data.notes);
    await logAdminAudit(request, {
      action: "contentops_draft_published",
      targetType: "contentops_draft",
      targetId: draft.id,
      metadata: {
        slug: draft.slug,
        hasNotes: Boolean(draft.publish_notes),
      },
    });
    // Best-effort on-demand revalidation so the article surfaces on the
    // public site within seconds rather than waiting for the ISR window.
    // Failure here is non-fatal — the engine already considers the draft
    // published, and ISR (revalidate=300, set in Commit K) is the safety
    // net. We log but don't propagate so the operator's publish action
    // doesn't appear to fail just because the cache layer hiccuped.
    try {
      revalidatePath("/blog");
      revalidatePath(`/blog/${draft.slug}`);
      revalidatePath("/");
    } catch (revalidateErr) {
      captureServerError(
        "api_admin_contentops_publish_revalidate_failed",
        revalidateErr instanceof Error
          ? revalidateErr
          : new Error(String(revalidateErr)),
        { draftId: id, slug: draft.slug },
      );
    }
    // Best-effort topic sync: when a published draft is linked back to
    // a topic, promote the topic's status to 'published' so the
    // editorial queue reflects what's actually live. No-op when no
    // topic references this draft. Failure is logged but never blocks
    // the operator's publish action.
    try {
      await notifyDraftPublished(draft.id);
    } catch (topicErr) {
      captureServerError(
        "api_admin_contentops_publish_topic_sync_failed",
        topicErr instanceof Error ? topicErr : new Error(String(topicErr)),
        { draftId: id, slug: draft.slug },
      );
    }
    return NextResponse.json({ ok: true, draft });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to mark draft published";
    captureServerError(
      "api_admin_contentops_publish_failed",
      err instanceof Error ? err : new Error(message),
      { draftId: id },
    );
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
