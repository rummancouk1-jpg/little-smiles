import { timingSafeEqual } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

type SupabaseAuthUser = {
  id: string;
  email?: string | null;
};

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/** Constant-time compare to prevent timing oracles on the admin password. */
function safeEqualStrings(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function allowedEmails(): Set<string> {
  const raw = process.env.ADMIN_ALLOWED_EMAILS?.trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((item) => normalizeEmail(item))
      .filter(Boolean),
  );
}

function authMode(): "secret" | "supabase" {
  return process.env.ADMIN_AUTH_MODE?.trim().toLowerCase() === "supabase" ? "supabase" : "secret";
}

function getSupabaseAnonClient() {
  const url = process.env.SUPABASE_URL?.trim();
  const anonKey = process.env.SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function verifyAdminCredentials(payload: {
  email?: string;
  password: string;
}): Promise<{ ok: true; actorLabel: string } | { ok: false; error: string }> {
  if (authMode() === "secret") {
    const adminSecret = process.env.ADMIN_SECRET?.trim();
    if (!adminSecret) return { ok: false, error: "ADMIN_SECRET missing" };
    if (!safeEqualStrings(payload.password, adminSecret)) {
      return { ok: false, error: "Invalid credentials" };
    }
    const adminLabel = process.env.ADMIN_DEFAULT_LABEL?.trim() || "primary_admin";
    return { ok: true, actorLabel: adminLabel };
  }

  const email = payload.email?.trim();
  if (!email) return { ok: false, error: "Email is required" };

  const supabase = getSupabaseAnonClient();
  if (!supabase) return { ok: false, error: "SUPABASE_ANON_KEY missing" };

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: payload.password,
  });
  if (error || !data.user) return { ok: false, error: "Invalid credentials" };

  const user = data.user as SupabaseAuthUser;
  const userEmail = normalizeEmail(user.email ?? "");
  const allowlist = allowedEmails();
  if (allowlist.size > 0 && !allowlist.has(userEmail)) {
    return { ok: false, error: "Admin access denied" };
  }

  return { ok: true, actorLabel: userEmail || user.id };
}

export function currentAdminAuthMode(): "secret" | "supabase" {
  return authMode();
}
