import { getClientIp } from "@/lib/admin-rate-limit";

type Bucket = {
  count: number;
  windowStart: number;
};

const buckets = new Map<string, Bucket>();

export function checkRequestRateLimit(input: {
  request: Request;
  routeKey: string;
  limit: number;
  windowMs: number;
}): {
  allowed: boolean;
  retryAfterSeconds: number;
  remaining: number;
} {
  const ip = getClientIp(input.request);
  const key = `${input.routeKey}:${ip}`;
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || now - current.windowStart >= input.windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return { allowed: true, retryAfterSeconds: 0, remaining: Math.max(0, input.limit - 1) };
  }

  if (current.count >= input.limit) {
    const retryAfterMs = current.windowStart + input.windowMs - now;
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
      remaining: 0,
    };
  }

  current.count += 1;
  buckets.set(key, current);
  return {
    allowed: true,
    retryAfterSeconds: 0,
    remaining: Math.max(0, input.limit - current.count),
  };
}
