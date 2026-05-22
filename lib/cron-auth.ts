import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

/**
 * Constant-time Bearer-token check for Vercel Cron endpoints.
 * Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}` on scheduled
 * invocations. Operators can hit the same endpoint manually with the
 * same header or `?secret=` query param to verify routing / re-trigger.
 *
 * Returns false when CRON_SECRET is unset so endpoints fail closed in
 * partial environments rather than executing unauthenticated work.
 */

export type CronAuthDebug = {
  hasCronSecret: boolean;
  receivedQuerySecret: boolean;
  receivedBearer: boolean;
  secretLengthMatches: boolean;
};

function timingSafeEqualUtf8(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function isNextRequest(request: Request | NextRequest): request is NextRequest {
  return "nextUrl" in request && request.nextUrl != null;
}

/** Prefer NextRequest.nextUrl.searchParams — reliable on Vercel; fall back to request.url. */
function getQuerySecret(request: Request | NextRequest): string | null {
  if (isNextRequest(request)) {
    return request.nextUrl.searchParams.get("secret")?.trim() ?? null;
  }
  try {
    return new URL(request.url).searchParams.get("secret")?.trim() ?? null;
  } catch {
    return null;
  }
}

function getBearerToken(request: Request | NextRequest): string | null {
  const authHeader = request.headers.get("authorization")?.trim();
  if (!authHeader) return null;
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : authHeader;
}

export function getCronAuthDebug(request: Request | NextRequest): CronAuthDebug {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const hasCronSecret = Boolean(cronSecret);
  const querySecret = getQuerySecret(request);
  const bearerToken = getBearerToken(request);
  const receivedQuerySecret = Boolean(querySecret);
  const receivedBearer = Boolean(bearerToken);

  let secretLengthMatches = false;
  if (cronSecret) {
    if (querySecret) {
      secretLengthMatches = querySecret.length === cronSecret.length;
    } else if (bearerToken) {
      secretLengthMatches = bearerToken.length === cronSecret.length;
    }
  }

  return {
    hasCronSecret,
    receivedQuerySecret,
    receivedBearer,
    secretLengthMatches,
  };
}

export function isAuthorizedCronRequest(request: Request | NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) return false;

  const bearerToken = getBearerToken(request);
  if (bearerToken && timingSafeEqualUtf8(bearerToken, cronSecret)) {
    return true;
  }

  const querySecret = getQuerySecret(request);
  if (querySecret && timingSafeEqualUtf8(querySecret, cronSecret)) {
    return true;
  }

  return false;
}
