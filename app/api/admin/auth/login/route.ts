import { NextResponse } from "next/server";
import { z } from "zod";

import {
  adminCookieName,
  adminSessionMaxAgeSeconds,
  createAdminSessionToken,
} from "@/lib/admin-auth";
import { logAdminAudit } from "@/lib/admin-audit";
import { currentAdminAuthMode, verifyAdminCredentials } from "@/lib/admin-identity";
import { checkAndConsumeLoginAttempt } from "@/lib/admin-rate-limit";

const loginSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const rateLimit = checkAndConsumeLoginAttempt(request);
  if (!rateLimit.allowed) {
    await logAdminAudit(request, {
      action: "admin_login_rate_limited",
      metadata: { retryAfterSeconds: rateLimit.retryAfterSeconds },
    });
    return NextResponse.json(
      {
        ok: false,
        error: "Too many attempts. Try again later.",
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    await logAdminAudit(request, { action: "admin_login_invalid_json" });
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(json);
  if (!parsed.success) {
    await logAdminAudit(request, { action: "admin_login_invalid_body" });
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }

  const verified = await verifyAdminCredentials({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (!verified.ok) {
    await logAdminAudit(request, { action: "admin_login_failed" });
    const code = verified.error.includes("missing") ? 503 : 401;
    return NextResponse.json({ ok: false, error: verified.error }, { status: code });
  }

  const token = createAdminSessionToken(verified.actorLabel);
  if (!token) {
    await logAdminAudit(request, { action: "admin_login_token_failed" });
    return NextResponse.json({ ok: false, error: "Could not create session" }, { status: 500 });
  }

  await logAdminAudit(request, {
    action: "admin_login_success",
    metadata: { actorLabel: verified.actorLabel, mode: currentAdminAuthMode() },
  });
  const response = NextResponse.json({ ok: true, mode: currentAdminAuthMode() });
  response.cookies.set(adminCookieName(), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: adminSessionMaxAgeSeconds(),
  });
  return response;
}
