import { NextResponse } from "next/server";

import { logAdminAudit } from "@/lib/admin-audit";
import { isAuthorizedAdminRequest } from "@/lib/admin-auth";

// Whitelisted "page-level" audit events. Limiting the set keeps the table
// observable (fixed action vocabulary) and prevents a misbehaving client
// from spamming arbitrary action names into the log.
const ALLOWED_ACTIONS = new Set<string>([
  "improve_draft_opened",
  "prepare_publish_opened",
  "improve_brief_copied",
  "publish_output_copied",
  "client_report_viewed",
  "client_summary_copied",
  "image_prompt_copied",
  "link_suggestion_copied",
  "ga4_debug_run",
  "seo_cron_triggered_manual",
  "keyword_brief_copied",
  "keyword_opportunities_opened",
]);

const MAX_TARGET_LEN = 80;
const MAX_METADATA_BYTES = 2_048;

type Body = {
  action?: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
};

function sanitizeTarget(v: string | null | undefined): string | null {
  if (v == null) return null;
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, MAX_TARGET_LEN);
}

function sanitizeMetadata(
  m: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (m == null) return null;
  try {
    const serialized = JSON.stringify(m);
    if (serialized.length > MAX_METADATA_BYTES) return null;
    return JSON.parse(serialized) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  if (!isAuthorizedAdminRequest(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const action = typeof body.action === "string" ? body.action.trim() : "";
  if (!ALLOWED_ACTIONS.has(action)) {
    return NextResponse.json(
      { ok: false, error: "Unknown action — not in whitelist." },
      { status: 400 },
    );
  }

  try {
    await logAdminAudit(request, {
      action,
      targetType: sanitizeTarget(body.targetType),
      targetId: sanitizeTarget(body.targetId),
      metadata: sanitizeMetadata(body.metadata),
    });
  } catch {
    // Audit is best-effort — never let it fail the caller.
  }

  return NextResponse.json({ ok: true });
}
