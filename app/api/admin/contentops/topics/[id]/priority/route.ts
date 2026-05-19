import { NextResponse } from "next/server";
import { z } from "zod";

import { isAuthorizedAdminRequest } from "@/lib/admin-auth";
import { logAdminAudit } from "@/lib/admin-audit";
import { updateTopicPriority } from "@/lib/contentops/topics-store";
import { captureServerError } from "@/lib/error-observability";

const bodySchema = z.object({
  priority: z.enum(["high", "medium", "low"]),
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
    return NextResponse.json({ ok: false, error: "Invalid priority" }, { status: 400 });
  }

  try {
    const topic = await updateTopicPriority(id, parsed.data.priority);
    await logAdminAudit(request, {
      action: "contentops_topic_priority_updated",
      targetType: "contentops_topic",
      targetId: topic.id,
      metadata: { title: topic.title, priority: parsed.data.priority },
    });
    return NextResponse.json({ ok: true, topic });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update priority";
    captureServerError(
      "api_admin_contentops_topic_priority_failed",
      err instanceof Error ? err : new Error(message),
      { topicId: id, priority: parsed.data.priority },
    );
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
