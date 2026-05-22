// Labeled, sanitising structured logger for the SEO intelligence pipeline.
//
// Every log line uses a stable uppercase label so the production cron logs
// can be filtered and alerted on without parsing free-form text. The
// sanitizer strips PEM blocks, bearer tokens, and obvious key material
// before anything reaches stdout/stderr.

export type SeoLogLabel =
  | "GA4_FETCH_START"
  | "GA4_FETCH_SUCCESS"
  | "GA4_FETCH_FAILED"
  | "GA4_VALIDATION_WARNING"
  | "GA4_ENV_MISSING"
  | "GA4_KEY_PARSE_FAILED"
  | "GA4_AUTH_FAILED"
  | "GA4_PROPERTY_ACCESS_FAILED"
  | "GA4_EMPTY_RESPONSE"
  | "GA4_SNAPSHOT_INSERT_SUCCESS"
  | "GA4_SNAPSHOT_INSERT_FAILED"
  | "GA4_SUPABASE_WRITE_SUCCESS"
  | "GA4_SUPABASE_WRITE_FAILED"
  | "GA4_DASHBOARD_READ_SUCCESS"
  | "GA4_DASHBOARD_READ_FAILED"
  | "GSC_FETCH_START"
  | "GSC_FETCH_SUCCESS"
  | "GSC_FETCH_FAILED"
  | "GSC_VALIDATION_WARNING"
  | "GSC_SUPABASE_WRITE_SUCCESS"
  | "GSC_SUPABASE_WRITE_FAILED"
  | "SNAPSHOT_PIPELINE_START"
  | "SNAPSHOT_PIPELINE_DONE"
  | "SNAPSHOT_HISTORY_QUERY_FAILED";

const REDACTORS: ReadonlyArray<[RegExp, string]> = [
  [/-----BEGIN[\s\S]*?-----END[^-]*-----/gi, "[redacted-pem]"],
  [/\b(private[_\s-]?key|client_email)\s*[:=]\s*\S+/gi, "$1=[redacted]"],
  [/\bBearer\s+\S+/gi, "Bearer [redacted]"],
];

function sanitizeString(s: string): string {
  let out = s;
  for (const [re, replacement] of REDACTORS) {
    out = out.replace(re, replacement);
  }
  if (out.length > 600) out = `${out.slice(0, 597)}...`;
  return out;
}

function sanitizeValue(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === "string") return sanitizeString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = sanitizeValue(v);
    }
    return out;
  }
  return String(value);
}

export function logSeo(label: SeoLogLabel, payload: Record<string, unknown> = {}): void {
  // Single-line console.error so Vercel surfaces this in the cron log
  // stream regardless of stdout buffering.
  const safe = sanitizeValue(payload) as Record<string, unknown>;
  console.error(label, { ts: new Date().toISOString(), ...safe });
}
