import { NextResponse } from "next/server";

import { logAdminAudit } from "@/lib/admin-audit";
import { isAuthorizedAdminRequest } from "@/lib/admin-auth";
import {
  DraftGenerationError,
  generateDraftForTopic,
  type DraftGenerationErrorCode,
} from "@/lib/contentops/draft-generation";
import { captureServerError } from "@/lib/error-observability";

// Generation calls Anthropic twice (draft + Opus critique) and hits Supabase —
// well beyond the default. Run on Node with a generous ceiling.
export const runtime = "nodejs";
export const maxDuration = 120;

/** Map a typed drafting failure to the right HTTP status for the UI. */
const STATUS_BY_CODE: Record<DraftGenerationErrorCode, number> = {
  invalid_topic: 400,
  duplicate_intent: 409,
  slug_conflict: 409,
  schema_validation: 422,
  model_no_tool_use: 502,
  anthropic: 502,
  config: 500,
  db: 500,
};

export async function POST(request: Request) {
  if (!isAuthorizedAdminRequest(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let topic: string;
  try {
    const body = (await request.json()) as { topic?: unknown };
    topic = typeof body.topic === "string" ? body.topic : "";
  } catch {
    return NextResponse.json(
      { ok: false, error: "Request body must be JSON with a `topic` string." },
      { status: 400 },
    );
  }

  try {
    // API keys stay server-side (env) — never passed from or exposed to the browser.
    const result = await generateDraftForTopic(topic);

    await logAdminAudit(request, {
      action: "contentops_draft_generate",
      targetType: "contentops_draft",
      targetId: result.id,
      metadata: {
        slug: result.slug,
        title: result.draft.title,
        critiqueFlags: result.critique?.flags.length ?? 0,
        validLinks: result.validLinkCount,
      },
    }).catch(() => {});

    return NextResponse.json({
      ok: true,
      draft: {
        id: result.id,
        slug: result.slug,
        title: result.draft.title,
      },
      warnings: result.warnings,
      critiqueFlags: result.critique?.flags.length ?? 0,
    });
  } catch (err) {
    if (err instanceof DraftGenerationError) {
      const status = STATUS_BY_CODE[err.code];
      // 4xx are operator-actionable (bad topic, duplicate) — not server faults,
      // so don't page on them. 5xx/502 are real failures worth capturing.
      if (status >= 500) {
        captureServerError("api_admin_contentops_generate_failed", err, {
          code: err.code,
          topic,
        });
      }
      return NextResponse.json(
        { ok: false, error: err.message, code: err.code },
        { status },
      );
    }
    const message = err instanceof Error ? err.message : "Failed to generate draft";
    captureServerError(
      "api_admin_contentops_generate_failed",
      err instanceof Error ? err : new Error(message),
      { topic },
    );
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
