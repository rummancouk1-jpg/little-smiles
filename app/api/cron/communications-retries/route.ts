import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { captureServerError } from "@/lib/error-observability";
import { processDueCommunicationRetries } from "@/lib/order-communication-retries";

function isAuthorizedCronRequest(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) return false;
  const authHeader = request.headers.get("authorization")?.trim();
  if (!authHeader) return false;
  const expected = `Bearer ${cronSecret}`;
  const a = Buffer.from(authHeader, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
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
