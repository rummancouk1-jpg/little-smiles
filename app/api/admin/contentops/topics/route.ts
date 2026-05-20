import { NextResponse } from "next/server";
import { z } from "zod";

import { isAuthorizedAdminRequest } from "@/lib/admin-auth";
import { logAdminAudit } from "@/lib/admin-audit";
import { createTopic } from "@/lib/contentops/topics-store";
import { captureServerError } from "@/lib/error-observability";

const bodySchema = z.object({
  title: z.string().min(5).max(200),
  intent: z.enum(["informational", "commercial", "transactional"]),
  related_category: z.string().min(1).max(100).optional().nullable(),
  priority: z.enum(["high", "medium", "low"]).optional(),
  seasonality: z
    .enum(["evergreen", "summer", "winter", "monsoon", "eid"])
    .optional(),
  notes: z.string().max(2000).optional().nullable(),
});

export async function POST(request: Request) {
  if (!isAuthorizedAdminRequest(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid topic payload" },
      { status: 400 },
    );
  }

  try {
    const topic = await createTopic(parsed.data);
    await logAdminAudit(request, {
      action: "contentops_topic_created",
      targetType: "contentops_topic",
      targetId: topic.id,
      metadata: {
        title: topic.title,
        intent: topic.intent,
        related_category: topic.related_category,
        priority: topic.priority,
        seasonality: topic.seasonality,
      },
    });
    return NextResponse.json({ ok: true, topic });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create topic";
    captureServerError(
      "api_admin_contentops_topic_create_failed",
      err instanceof Error ? err : new Error(message),
      { title: parsed.data.title },
    );
    // 400 if the message looks like a validation/collision error, 500 otherwise.
    const status =
      message.toLowerCase().includes("characters") ||
      message.toLowerCase().includes("already exists")
        ? 400
        : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
