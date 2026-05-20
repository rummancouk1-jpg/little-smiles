import { NextResponse } from "next/server";

import { isAuthorizedAdminRequest } from "@/lib/admin-auth";
import { logAdminAudit } from "@/lib/admin-audit";
import { markDraftUnscheduled } from "@/lib/contentops/drafts-store";
import { captureServerError } from "@/lib/error-observability";

type RouteProps = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: RouteProps) {
  if (!isAuthorizedAdminRequest(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const draft = await markDraftUnscheduled(id);
    await logAdminAudit(request, {
      action: "contentops_draft_unscheduled",
      targetType: "contentops_draft",
      targetId: draft.id,
      metadata: { slug: draft.slug },
    });
    return NextResponse.json({ ok: true, draft });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to unschedule draft";
    captureServerError(
      "api_admin_contentops_unschedule_failed",
      err instanceof Error ? err : new Error(message),
      { draftId: id },
    );
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
