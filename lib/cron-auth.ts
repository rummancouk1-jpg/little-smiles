import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time Bearer-token check for Vercel Cron endpoints.
 * Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}` on scheduled
 * invocations. Operators can hit the same endpoint manually with the
 * same header to verify routing / re-trigger a run.
 *
 * Returns false when CRON_SECRET is unset so endpoints fail closed in
 * partial environments rather than executing unauthenticated work.
 */
export function isAuthorizedCronRequest(request: Request): boolean {
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
