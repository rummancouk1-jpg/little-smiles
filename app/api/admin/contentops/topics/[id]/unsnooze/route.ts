import { NextResponse } from "next/server";

import { isAuthorizedAdminRequest } from "@/lib/admin-auth";
import { logAdminAudit } from "@/lib/admin-audit";
import { unsnoozeTopic } from "@/lib/contentops/topics-store";
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
    const topic = await unsnoozeTopic(id);
    await logAdminAudit(request, {
      action: "contentops_topic_unsnoozed",
      targetType: "contentops_topic",
      targetId: topic.id,
      metadata: { title: topic.title },
    });
    return NextResponse.json({ ok: true, topic });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to bring topic back";
    captureServerError(
      "api_admin_contentops_topic_unsnooze_failed",
      err instanceof Error ? err : new Error(message),
      { topicId: id },
    );
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
