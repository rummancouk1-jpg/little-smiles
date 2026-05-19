// In-app draft generation. Wraps lib/contentops/draft-generation in an
// admin-auth gate and an audit row.
//
// Generation takes 15-30 seconds because Anthropic Sonnet writes a full
// article body. maxDuration = 60 raises the serverless-function ceiling
// past the 10-second Vercel Hobby default; on Pro the route comfortably
// fits inside the 60-second cap.

import { NextResponse } from "next/server";
import { z } from "zod";

import { isAuthorizedAdminRequest } from "@/lib/admin-auth";
import { logAdminAudit } from "@/lib/admin-audit";
import { generateDraftFromTopic } from "@/lib/contentops/draft-generation";
import { captureServerError } from "@/lib/error-observability";

export const maxDuration = 60;

const bodySchema = z.object({
  topic: z.string().min(5).max(200),
});

export async function POST(request: Request) {
  if (!isAuthorizedAdminRequest(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Topic must be 5-200 characters." },
      { status: 400 },
    );
  }

  try {
    const result = await generateDraftFromTopic(parsed.data.topic);
    await logAdminAudit(request, {
      action: "contentops_draft_generated",
      targetType: "contentops_draft",
      targetId: result.id,
      metadata: {
        topic: parsed.data.topic,
        slug: result.slug,
        title: result.title,
      },
    });
    return NextResponse.json({ ok: true, draft: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate draft";
    captureServerError(
      "api_admin_contentops_draft_generate_failed",
      err instanceof Error ? err : new Error(message),
      { topic: parsed.data.topic },
    );
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
