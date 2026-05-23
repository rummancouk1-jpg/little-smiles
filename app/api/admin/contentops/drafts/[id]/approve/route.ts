import { NextResponse } from "next/server";

import { logAdminAudit } from "@/lib/admin-audit";
import { isAuthorizedAdminRequest } from "@/lib/admin-auth";
import { approveDraft } from "@/lib/contentops/drafts-store";
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
    const draft = await approveDraft(id);
    await logAdminAudit(request, {
      action: "contentops_draft_approve",
      targetType: "contentops_draft",
      targetId: draft.id,
      metadata: { slug: draft.slug, status: draft.status },
    }).catch(() => {});
    return NextResponse.json({ ok: true, draft });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to approve draft";
    captureServerError(
      "api_admin_contentops_approve_failed",
      err instanceof Error ? err : new Error(message),
      { draftId: id },
    );
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
