import { NextResponse } from "next/server";

import { logSystemAudit } from "@/lib/admin-audit";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { captureServerError } from "@/lib/error-observability";
import { processDueCommunicationRetries } from "@/lib/order-communication-retries";

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized cron request" }, { status: 401 });
  }

  try {
    const summary = await processDueCommunicationRetries();
    await logSystemAudit({
      action: "order_communication_auto_retry_run",
      targetType: "order_communication",
      metadata: summary,
    }).catch(() => {});
    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    captureServerError("api_cron_communications_retries_failed", error);
    return NextResponse.json({ ok: false, error: "Retry processing failed" }, { status: 500 });
  }
}
