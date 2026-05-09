import { createHmac, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";

const ADMIN_COOKIE_NAME = "ls_admin_session";
const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 hours

type AdminSessionPayload = {
  role: "admin";
  actorLabel: string;
  exp: number;
};

function getAdminSecret(): string | null {
  const secret = process.env.ADMIN_SECRET?.trim();
  return secret && secret.length > 0 ? secret : null;
}

function toBase64Url(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function fromBase64Url(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function parseCookieHeader(header: string | null): Record<string, string> {
  if (!header) return {};
  return header.split(";").reduce<Record<string, string>>((acc, entry) => {
    const [rawKey, ...rest] = entry.trim().split("=");
    if (!rawKey || rest.length === 0) return acc;
    acc[rawKey] = decodeURIComponent(rest.join("="));
    return acc;
  }, {});
}

function verifyToken(token: string, secret: string): AdminSessionPayload | null {
  const [payloadPart, sigPart] = token.split(".");
  if (!payloadPart || !sigPart) return null;

  const expectedSig = sign(payloadPart, secret);
  const providedBuf = Buffer.from(sigPart);
  const expectedBuf = Buffer.from(expectedSig);
  if (providedBuf.length !== expectedBuf.length) return null;
  if (!timingSafeEqual(providedBuf, expectedBuf)) return null;

  try {
    const payload = JSON.parse(fromBase64Url(payloadPart)) as AdminSessionPayload;
    const hasActorLabel = typeof payload.actorLabel === "string" && payload.actorLabel.trim().length > 0;
    if (payload.role !== "admin" || !Number.isFinite(payload.exp) || payload.exp <= Date.now() || !hasActorLabel) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function createAdminSessionToken(actorLabel: string): string | null {
  const secret = getAdminSecret();
  if (!secret) return null;
  const normalizedActorLabel = actorLabel.trim();
  if (normalizedActorLabel.length === 0) return null;

  const payload: AdminSessionPayload = {
    role: "admin",
    actorLabel: normalizedActorLabel.slice(0, 120),
    exp: Date.now() + ADMIN_SESSION_TTL_SECONDS * 1000,
  };
  const payloadPart = toBase64Url(JSON.stringify(payload));
  const signature = sign(payloadPart, secret);
  return `${payloadPart}.${signature}`;
}

export function adminCookieName(): string {
  return ADMIN_COOKIE_NAME;
}

export function adminSessionMaxAgeSeconds(): number {
  return ADMIN_SESSION_TTL_SECONDS;
}

export function isAuthorizedAdminRequest(request: Request): boolean {
  return getAdminSessionFromRequest(request) !== null;
}

export function getAdminSessionFromRequest(request: Request): AdminSessionPayload | null {
  const secret = getAdminSecret();
  if (!secret) return null;
  const cookieMap = parseCookieHeader(request.headers.get("cookie"));
  const token = cookieMap[ADMIN_COOKIE_NAME];
  if (!token) return null;
  return verifyToken(token, secret);
}

export async function isAuthorizedAdminPage(): Promise<boolean> {
  return (await getAdminSessionFromPage()) !== null;
}

export async function getAdminSessionFromPage(): Promise<AdminSessionPayload | null> {
  const secret = getAdminSecret();
  if (!secret) return null;
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token, secret);
}
