import { z } from "zod";

const envSchema = z.object({
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  ADMIN_SECRET: z.string().min(1).optional(),
  CRON_SECRET: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  CONTACT_TO_EMAIL: z.string().email().optional(),
  CONTACT_FROM_EMAIL: z.string().email().optional(),
  CONTENTOPS_DIGEST_TO: z.string().optional(),
  NEXT_PUBLIC_GA_ID: z.string().regex(/^G-[A-Z0-9]+$/).optional(),
  // Optional GSC + GA4 Data API service-account credentials. None are
  // required today — they light up the SEO intelligence "future" panels.
  GSC_CLIENT_EMAIL: z.string().email().optional(),
  GSC_PRIVATE_KEY: z.string().min(1).optional(),
  GSC_SITE_URL: z.string().url().optional(),
  GA4_PROPERTY_ID: z.string().min(1).optional(),
  GA4_CLIENT_EMAIL: z.string().email().optional(),
  GA4_PRIVATE_KEY: z.string().min(1).optional(),
  GA4_OAUTH_CLIENT_ID: z.string().min(1).optional(),
  GA4_OAUTH_CLIENT_SECRET: z.string().min(1).optional(),
  GA4_OAUTH_REFRESH_TOKEN: z.string().min(1).optional(),
});

type ValidationResult = {
  missingRequired: string[];
  invalidFormat: string[];
  optionalMissing: string[];
  ok: boolean;
};

let cached: ValidationResult | null = null;

export function validateRuntimeEnv(): ValidationResult {
  if (cached) return cached;

  const parsed = envSchema.safeParse(process.env);
  const invalidFormat = parsed.success
    ? []
    : parsed.error.issues.map((issue) => String(issue.path[0] ?? "unknown"));

  const requiredKeys = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "CRON_SECRET"] as const;
  const optionalKeys = [
    "RESEND_API_KEY",
    "CONTACT_TO_EMAIL",
    "CONTACT_FROM_EMAIL",
    "NEXT_PUBLIC_GA_ID",
  ] as const;

  const missingRequired: string[] = requiredKeys.filter((key) => !process.env[key]?.trim());
  const adminAuthMode = process.env.ADMIN_AUTH_MODE?.trim().toLowerCase() === "supabase" ? "supabase" : "secret";
  if (adminAuthMode === "supabase") {
    if (!process.env.SUPABASE_ANON_KEY?.trim()) missingRequired.push("SUPABASE_ANON_KEY");
  } else {
    if (!process.env.ADMIN_SECRET?.trim()) missingRequired.push("ADMIN_SECRET");
  }

  const optionalMissing = optionalKeys.filter((key) => !process.env[key]?.trim());

  if (process.env.RESEND_API_KEY?.trim()) {
    if (!process.env.CONTACT_TO_EMAIL?.trim()) missingRequired.push("CONTACT_TO_EMAIL");
    if (!process.env.CONTACT_FROM_EMAIL?.trim()) missingRequired.push("CONTACT_FROM_EMAIL");
  }

  cached = {
    missingRequired: Array.from(new Set(missingRequired)),
    invalidFormat: Array.from(new Set(invalidFormat)),
    optionalMissing,
    ok: missingRequired.length === 0 && invalidFormat.length === 0,
  };
  return cached;
}

export function assertRuntimeEnvAtStartup(): void {
  const result = validateRuntimeEnv();
  if (!result.ok) {
    console.error("[runtime-env] validation failed", result);
    const strict = process.env.NODE_ENV === "production" && process.env.RUNTIME_ENV_STRICT !== "false";
    if (strict) {
      throw new Error("Critical runtime environment validation failed.");
    }
  } else {
    if (result.optionalMissing.length > 0) {
      console.warn("[runtime-env] optional env vars missing", result.optionalMissing);
    }
  }
}
