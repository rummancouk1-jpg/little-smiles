import { NextResponse } from "next/server";
import { z } from "zod";

import { isAuthorizedAdminRequest } from "@/lib/admin-auth";
import { logAdminAudit } from "@/lib/admin-audit";
import { snoozeTopic } from "@/lib/contentops/topics-store";
import { captureServerError } from "@/lib/error-observability";

const bodySchema = z.object({
  days: z.number().int().min(1).max(180).optional(),
});

type RouteProps = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: RouteProps) {
  if (!isAuthorizedAdminRequest(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  let json: unknown = {};
  try {
    json = await request.json();
  } catch {
    json = {};
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid snooze days" }, { status: 400 });
  }

  try {
    const topic = await snoozeTopic(id, parsed.data.days ?? 30);
    await logAdminAudit(request, {
      action: "contentops_topic_snoozed",
      targetType: "contentops_topic",
      targetId: topic.id,
      metadata: {
        title: topic.title,
        snoozedUntil: topic.snoozed_until,
        days: parsed.data.days ?? 30,
      },
    });
    return NextResponse.json({ ok: true, topic });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save topic for later";
    captureServerError(
      "api_admin_contentops_topic_snooze_failed",
      err instanceof Error ? err : new Error(message),
      { topicId: id },
    );
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
