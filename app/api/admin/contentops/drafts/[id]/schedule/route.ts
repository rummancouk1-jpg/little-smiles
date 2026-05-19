import { NextResponse } from "next/server";
import { z } from "zod";

import { isAuthorizedAdminRequest } from "@/lib/admin-auth";
import { logAdminAudit } from "@/lib/admin-audit";
import { markDraftScheduled } from "@/lib/contentops/drafts-store";
import { captureServerError } from "@/lib/error-observability";

// Operator must schedule at least this far in the future. Guards against
// accidental "schedule for 30 seconds ago" inputs and gives the cron at
// least one tick of headroom before the row becomes due.
const MIN_SCHEDULE_LEAD_MS = 60_000;

const scheduleSchema = z.object({
  scheduledAt: z.string().datetime({ offset: true }),
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

  const parsed = scheduleSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  const scheduledAtMs = new Date(parsed.data.scheduledAt).getTime();
  if (!Number.isFinite(scheduledAtMs)) {
    return NextResponse.json(
      { ok: false, error: "scheduledAt is not a valid timestamp" },
      { status: 400 },
    );
  }
  if (scheduledAtMs - Date.now() < MIN_SCHEDULE_LEAD_MS) {
    return NextResponse.json(
      { ok: false, error: "scheduledAt must be at least one minute in the future" },
      { status: 400 },
    );
  }

  try {
    const draft = await markDraftScheduled(id, parsed.data.scheduledAt, parsed.data.notes);
    await logAdminAudit(request, {
      action: "contentops_draft_scheduled",
      targetType: "contentops_draft",
      targetId: draft.id,
      metadata: {
        slug: draft.slug,
        scheduledAt: draft.scheduled_at,
        hasNotes: Boolean(draft.publish_notes),
      },
    });
    return NextResponse.json({ ok: true, draft });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to schedule draft";
    captureServerError(
      "api_admin_contentops_schedule_failed",
      err instanceof Error ? err : new Error(message),
      { draftId: id },
    );
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
