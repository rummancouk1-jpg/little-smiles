import { NextResponse } from "next/server";

import { adminCookieName } from "@/lib/admin-auth";
import { logAdminAudit } from "@/lib/admin-audit";

export async function POST(request: Request) {
  await logAdminAudit(request, { action: "admin_logout" });
  const response = NextResponse.json({ ok: true });
  response.headers.set("Cache-Control", "no-store");
  response.cookies.set(adminCookieName(), "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
