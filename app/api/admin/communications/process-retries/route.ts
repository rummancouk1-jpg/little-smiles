import { NextResponse } from "next/server";

import { isAuthorizedAdminRequest } from "@/lib/admin-auth";
import { logAdminAudit } from "@/lib/admin-audit";
import { captureServerError } from "@/lib/error-observability";
import { processDueCommunicationRetries } from "@/lib/order-communication-retries";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  if (!isAuthorizedAdminRequest(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 503 });
  }

  let summary;
  try {
    summary = await processDueCommunicationRetries();
  } catch (error) {
    captureServerError("api_admin_communications_process_retries_failed", error);
    return NextResponse.json({ ok: false, error: "Could not load retries" }, { status: 500 });
  }

  await logAdminAudit(request, {
    action: "order_communication_auto_retry_run",
    targetType: "order_communication",
    metadata: summary,
  });

  return NextResponse.json({ ok: true, ...summary });
}
