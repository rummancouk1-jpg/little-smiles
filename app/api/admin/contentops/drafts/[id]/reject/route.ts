import { NextResponse } from "next/server";
import { z } from "zod";

import { logAdminAudit } from "@/lib/admin-audit";
import { isAuthorizedAdminRequest } from "@/lib/admin-auth";
import { getDraftById, rejectDraft } from "@/lib/contentops/drafts-store";
import { computeRejectionReason } from "@/lib/contentops/rejection-reason";
import { captureServerError } from "@/lib/error-observability";

const rejectSchema = z.object({
  note: z.string().max(2000).optional(),
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

  const parsed = rejectSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  try {
    // Snapshot WHICH checks were failing at reject time (structured reason
    // alongside the free-text note) — the feed-forward learning signal. Never
    // let this computation block the reject itself.
    let reason: ReturnType<typeof computeRejectionReason> | null = null;
    try {
      const existing = await getDraftById(id);
      if (existing) reason = computeRejectionReason(existing);
    } catch {
      reason = null;
    }
    const draft = await rejectDraft(id, parsed.data.note, reason);
    await logAdminAudit(request, {
      action: "contentops_draft_reject",
      targetType: "contentops_draft",
      targetId: draft.id,
      metadata: {
        slug: draft.slug,
        status: draft.status,
        hasNote: Boolean(parsed.data.note && parsed.data.note.trim().length > 0),
        failedCheckKeys: reason?.failedChecks.map((c) => c.key) ?? [],
      },
    }).catch(() => {});
    return NextResponse.json({ ok: true, draft });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to reject draft";
    captureServerError(
      "api_admin_contentops_reject_failed",
      err instanceof Error ? err : new Error(message),
      { draftId: id },
    );
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
