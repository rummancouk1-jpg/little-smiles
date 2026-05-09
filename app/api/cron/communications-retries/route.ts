import { NextResponse } from "next/server";

import { captureServerError } from "@/lib/error-observability";
import { processDueCommunicationRetries } from "@/lib/order-communication-retries";

function isAuthorizedCronRequest(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) return false;
  const authHeader = request.headers.get("authorization")?.trim();
  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized cron request" }, { status: 401 });
  }

  try {
    const summary = await processDueCommunicationRetries();
    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    captureServerError("api_cron_communications_retries_failed", error);
    return NextResponse.json({ ok: false, error: "Retry processing failed" }, { status: 500 });
  }
}
