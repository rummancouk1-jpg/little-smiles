const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 8;

type RateLimitState = {
  count: number;
  windowStart: number;
};

const attemptsByIp = new Map<string, RateLimitState>();

function nowMs(): number {
  return Date.now();
}

function normalizeIp(ip: string | null | undefined): string {
  const value = ip?.trim();
  return value && value.length > 0 ? value : "unknown";
}

export function getClientIp(request: Request): string {
  const xForwardedFor = request.headers.get("x-forwarded-for");
  if (xForwardedFor) {
    const first = xForwardedFor.split(",")[0]?.trim();
    if (first) return normalizeIp(first);
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return normalizeIp(realIp);

  return "unknown";
}

export function checkAndConsumeLoginAttempt(request: Request): {
  allowed: boolean;
  retryAfterSeconds: number;
  remainingAttempts: number;
} {
  const ip = getClientIp(request);
  const now = nowMs();
  const current = attemptsByIp.get(ip);

  if (!current || now - current.windowStart >= WINDOW_MS) {
    attemptsByIp.set(ip, { count: 1, windowStart: now });
    return {
      allowed: true,
      retryAfterSeconds: 0,
      remainingAttempts: MAX_ATTEMPTS - 1,
    };
  }

  if (current.count >= MAX_ATTEMPTS) {
    const retryMs = current.windowStart + WINDOW_MS - now;
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil(retryMs / 1000)),
      remainingAttempts: 0,
    };
  }

  current.count += 1;
  attemptsByIp.set(ip, current);

  return {
    allowed: true,
    retryAfterSeconds: 0,
    remainingAttempts: Math.max(0, MAX_ATTEMPTS - current.count),
  };
}
