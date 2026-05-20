// Restore a draft to either its single-step previous version or its
// original AI-generated snapshot. The engine handles the actual swap
// and the resulting manually_edited flag; this route is a thin
// auth-gated wrapper with audit logging.

import { NextResponse } from "next/server";
import { z } from "zod";

import { isAuthorizedAdminRequest } from "@/lib/admin-auth";
import { logAdminAudit } from "@/lib/admin-audit";
import {
  restoreAiVersion,
  restorePreviousVersion,
} from "@/lib/contentops/drafts-store";
import { captureServerError } from "@/lib/error-observability";

const bodySchema = z.object({
  source: z.enum(["previous", "ai_generated"]),
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
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "source must be 'previous' or 'ai_generated'" },
      { status: 400 },
    );
  }

  try {
    const draft =
      parsed.data.source === "previous"
        ? await restorePreviousVersion(id)
        : await restoreAiVersion(id);
    await logAdminAudit(request, {
      action:
        parsed.data.source === "previous"
          ? "contentops_draft_restored_previous"
          : "contentops_draft_restored_ai",
      targetType: "contentops_draft",
      targetId: draft.id,
      metadata: { slug: draft.slug, status: draft.status },
    });
    return NextResponse.json({ ok: true, draft });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to restore";
    captureServerError(
      "api_admin_contentops_draft_restore_failed",
      err instanceof Error ? err : new Error(message),
      { draftId: id, source: parsed.data.source },
    );
    // 400 for "no snapshot" / "frozen" cases; 500 for genuine engine
    // failures.
    const isUserError =
      message.includes("No ") || message.includes("Cannot");
    return NextResponse.json(
      { ok: false, error: message },
      { status: isUserError ? 400 : 500 },
    );
  }
}
