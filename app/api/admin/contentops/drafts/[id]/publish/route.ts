import { NextResponse } from "next/server";
import { z } from "zod";

import { isAuthorizedAdminRequest } from "@/lib/admin-auth";
import { logAdminAudit } from "@/lib/admin-audit";
import { markDraftPublished } from "@/lib/contentops/drafts-store";
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
