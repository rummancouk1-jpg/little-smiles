// Google Analytics 4 Data API provider.
//
// Activation (pick one auth path + property ID):
//
// OAuth user (preferred when set — works in GA4 Admin user access UI):
//   GA4_PROPERTY_ID
//   GA4_OAUTH_CLIENT_ID / GA4_OAUTH_CLIENT_SECRET / GA4_OAUTH_REFRESH_TOKEN
//
// Service account (fallback):
//   GA4_PROPERTY_ID
//   GA4_CLIENT_EMAIL / GA4_PRIVATE_KEY
//
// Read-only. Fetcher never writes.

import { BetaAnalyticsDataClient } from "@google-analytics/data";
import { GoogleError } from "google-gax";

import {
  createGa4OAuth2Client,
  isGa4OAuthConfigured,
  missingGa4OAuthEnvKeys,
  type Ga4OAuthEnv,
} from "@/lib/providers/google-user-oauth";
import { logSeo } from "@/lib/seo-intelligence/logger";

const DEGENERATE_GA4_MESSAGE = "undefined undefined: undefined";

const DEFAULT_LIMIT = 200;
const DEFAULT_TIMEOUT_MS = 25_000;

export type Ga4AuthMode = "oauth_user" | "service_account";

export type Ga4ConnectionState =
  | { connected: false; reason: string; missingEnv: string[]; authMode: null }
  | { connected: true; propertyId: string; authMode: Ga4AuthMode };

const SA_ENV_KEYS = ["GA4_CLIENT_EMAIL", "GA4_PRIVATE_KEY"] as const;

type Ga4Env = Ga4OAuthEnv & {
  GA4_PROPERTY_ID?: string;
  GA4_CLIENT_EMAIL?: string;
  GA4_PRIVATE_KEY?: string;
};

function isServiceAccountConfigured(env: Ga4Env): boolean {
  return SA_ENV_KEYS.every((key) => Boolean(env[key]?.trim()));
}

function missingServiceAccountEnvKeys(env: Ga4Env): string[] {
  return SA_ENV_KEYS.filter((key) => !env[key]?.trim());
}

export function getGa4ConnectionState(): Ga4ConnectionState {
  const env = process.env as Ga4Env;
  const propertyId = env.GA4_PROPERTY_ID?.trim();

  if (!propertyId) {
    return {
      connected: false,
      authMode: null,
      reason:
        "GA4 Data API is not connected. Set GA4_PROPERTY_ID plus OAuth (GA4_OAUTH_CLIENT_ID, GA4_OAUTH_CLIENT_SECRET, GA4_OAUTH_REFRESH_TOKEN) or service account (GA4_CLIENT_EMAIL, GA4_PRIVATE_KEY).",
      missingEnv: ["GA4_PROPERTY_ID"],
    };
  }

  if (isGa4OAuthConfigured(env)) {
    return { connected: true, propertyId, authMode: "oauth_user" };
  }

  if (isServiceAccountConfigured(env)) {
    return { connected: true, propertyId, authMode: "service_account" };
  }

  const missing = [
    ...missingGa4OAuthEnvKeys(env),
    ...missingServiceAccountEnvKeys(env),
  ];
  return {
    connected: false,
    authMode: null,
    reason:
      "GA4 auth is not configured. Set all GA4_OAUTH_* vars (preferred) or GA4_CLIENT_EMAIL + GA4_PRIVATE_KEY.",
    missingEnv: Array.from(new Set(missing)),
  };
}

export type Ga4PagePathRow = {
  pagePath: string;
  sessions: number;
  totalUsers: number;
  averageSessionDurationSeconds: number;
  bounceRate: number;
};

export type Ga4PagePathWindow = {
  startDate: string;
  endDate: string;
  rows: Ga4PagePathRow[];
};

export type Ga4FetchOptions = {
  startDate: string;
  endDate: string;
  limit?: number;
  timeoutMs?: number;
};

/**
 * Specific failure modes the cron / dashboard / debug endpoint can
 * branch on. `unknown` is the safe default — callers should still
 * present `reason` for human context.
 */
export type Ga4FailureCode =
  | "env_missing"
  | "key_parse_failed"
  | "auth_failed"
  | "property_access_failed"
  | "api_disabled"
  | "empty_response"
  | "timeout"
  | "unknown";

/**
 * Safe subset of fields lifted from any error the GA4 SDK throws.
 * Everything here is run through sanitizeForLog before it leaves the
 * provider — callers can echo it back to the dashboard / debug endpoint
 * without leaking secrets.
 *
 * `GoogleError` from google-gax carries the real cause in extra fields
 * (`details`, `note`, `reason`, `statusDetails`, `errorInfoMetadata`)
 * even when `.message` is the degenerate "undefined undefined: undefined"
 * template. The googleapis HTTP transport instead stores the real cause
 * under `response.data.error.{message,code,status}`. We capture all of
 * them here so the dashboard / debug endpoint can render whichever
 * shape the SDK chose.
 */
export type Ga4SafeErrorFields = {
  name: string | null;
  message: string | null;
  /** gRPC code (number) or string code if SDK uses one. */
  code: number | string | null;
  /** Textual gRPC status (e.g. "PERMISSION_DENIED"). */
  status: string | null;
  /** SDK-emitted `details` — either string or JSON-stringified array. */
  details: string | null;
  /** First line of `stack` only — drops absolute file paths beyond the first. */
  stackFirstLine: string | null;
  /** GoogleError extras — populated when the SDK exposes them. */
  note: string | null;
  reason: string | null;
  domain: string | null;
  statusDetails: string | null;
  /** googleapis HTTP error shape — `response.data.error.*`. */
  httpStatusText: string | null;
  /** gRPC ServiceError human text (`details`, not `message`). */
  grpcDetails: string | null;
  /** google.rpc.ErrorInfo metadata map when the SDK decodes it. */
  errorInfoMetadata: string | null;
  /** Best-effort hint from gRPC metadata (`grpc-message`, `grpc-status`, …). */
  metadataHint: string | null;
  /** Sanitised list of top-level keys present on the original error. */
  ownKeys: string[];
  /** Recursively-extracted parent error when the SDK uses `cause` chains. */
  cause: Ga4SafeErrorFields | null;
};

export type Ga4FetchResult =
  | { ok: true; window: Ga4PagePathWindow }
  | {
      ok: false;
      reason: string;
      code: Ga4FailureCode;
      /** Present whenever the failure came from the SDK rather than env / pre-flight. */
      safeFields?: Ga4SafeErrorFields;
    };

function decodePrivateKey(raw: string): string {
  return raw.replace(/\\n/g, "\n");
}

/** Sanitiser for any string about to be logged / returned. */
function sanitizeForLog(raw: string): string {
  let s = raw;
  s = s.replace(/-----BEGIN[\s\S]*?-----END[^-]*-----/gi, "[redacted-pem]");
  s = s.replace(/\b(private[_\s-]?key|client_email)\s*[:=]\s*\S+/gi, "$1=[redacted]");
  s = s.replace(/\bBearer\s+\S+/gi, "Bearer [redacted]");
  if (s.length > 600) s = `${s.slice(0, 597)}...`;
  return s;
}

const EMPTY_FIELDS: Ga4SafeErrorFields = {
  name: null,
  message: null,
  code: null,
  status: null,
  details: null,
  stackFirstLine: null,
  note: null,
  reason: null,
  domain: null,
  statusDetails: null,
  httpStatusText: null,
  grpcDetails: null,
  errorInfoMetadata: null,
  metadataHint: null,
  ownKeys: [],
  cause: null,
};

/**
 * Run google-gax metadata decoding on the raw thrown value (and its
 * `cause` chain) before we read fields. Never wraps or replaces the error.
 */
function enrichGa4SdkError(err: unknown): void {
  if (!err || typeof err !== "object") return;
  const seen = new WeakSet<object>();

  const walk = (node: unknown, depth: number): void => {
    if (depth > 4 || !node || typeof node !== "object" || seen.has(node)) return;
    seen.add(node);
    try {
      GoogleError.parseGRPCStatusDetails(node as GoogleError);
    } catch {
      // Non-fatal — some errors lack grpc-status-details-bin metadata.
    }
    const cause = (node as Record<string, unknown>).cause;
    if (cause != null && cause !== node) walk(cause, depth + 1);
  };

  walk(err, 0);
}

/** Direct console log of safe fields from the original SDK error (pre-wrap). */
function logGa4CaughtErrorRaw(err: unknown, phase: "before_enrich" | "after_enrich"): void {
  const f = extractSafeGa4ErrorFields(err);
  console.error("GA4_SDK_ERROR_RAW", {
    phase,
    name: f.name,
    message: f.message,
    code: f.code,
    status: f.status,
    grpcDetails: f.grpcDetails,
    details: f.details,
    note: f.note,
    reason: f.reason,
    domain: f.domain,
    statusDetails: f.statusDetails,
    errorInfoMetadata: f.errorInfoMetadata,
    httpStatusText: f.httpStatusText,
    metadataHint: f.metadataHint,
    ownKeys: f.ownKeys,
    cause: f.cause
      ? {
          name: f.cause.name,
          code: f.cause.code,
          status: f.cause.status,
          grpcDetails: f.cause.grpcDetails,
          message: f.cause.message,
          reason: f.cause.reason,
          ownKeys: f.cause.ownKeys,
        }
      : null,
  });
}

function extractMetadataHint(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const m = metadata as { get?: (key: string) => unknown };
  if (typeof m.get !== "function") return null;

  const parts: string[] = [];
  for (const key of ["grpc-message", "grpc-status"] as const) {
    try {
      const val = m.get(key);
      const text = Array.isArray(val) ? val.map(String).join(", ") : val != null ? String(val) : "";
      const trimmed = text.trim();
      if (trimmed.length > 0 && trimmed !== DEGENERATE_GA4_MESSAGE) {
        parts.push(`${key}=${sanitizeForLog(trimmed)}`);
      }
    } catch {
      // ignore malformed metadata
    }
  }
  if (parts.length === 0) return null;
  return sanitizeForLog(parts.join("; "));
}

/** Flatten this node + `cause` for classification / human reason strings. */
function mergeGa4SafeFields(fields: Ga4SafeErrorFields): Ga4SafeErrorFields {
  const merged: Ga4SafeErrorFields = { ...fields, ownKeys: [...fields.ownKeys] };
  let cursor = fields.cause;
  while (cursor) {
    if (!merged.message && cursor.message) merged.message = cursor.message;
    if (merged.code == null && cursor.code != null) merged.code = cursor.code;
    if (!merged.status && cursor.status) merged.status = cursor.status;
    if (!merged.grpcDetails && cursor.grpcDetails) merged.grpcDetails = cursor.grpcDetails;
    if (!merged.details && cursor.details) merged.details = cursor.details;
    if (!merged.note && cursor.note) merged.note = cursor.note;
    if (!merged.reason && cursor.reason) merged.reason = cursor.reason;
    if (!merged.domain && cursor.domain) merged.domain = cursor.domain;
    if (!merged.statusDetails && cursor.statusDetails) merged.statusDetails = cursor.statusDetails;
    if (!merged.httpStatusText && cursor.httpStatusText) merged.httpStatusText = cursor.httpStatusText;
    if (!merged.errorInfoMetadata && cursor.errorInfoMetadata) {
      merged.errorInfoMetadata = cursor.errorInfoMetadata;
    }
    if (!merged.metadataHint && cursor.metadataHint) merged.metadataHint = cursor.metadataHint;
    cursor = cursor.cause;
  }
  return merged;
}

function safeStringField(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed === DEGENERATE_GA4_MESSAGE) return null;
  return sanitizeForLog(trimmed);
}

function safeObjectAsString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return safeStringField(value);
  try {
    const s = JSON.stringify(value);
    if (!s || s === "{}" || s === "[]") return null;
    return sanitizeForLog(s);
  } catch {
    return null;
  }
}

/**
 * Extract a structured, safe shape from any thrown value. The GA4 SDK
 * sometimes throws `GoogleError` instances where `.message` is the
 * literal string "undefined undefined: undefined" (a degenerate
 * `${code} ${status}: ${note}` formatting). This extractor reads the
 * underlying fields directly so the dashboard never has to display
 * that template, and recursively walks `err.cause` for Node-standard
 * error chains.
 *
 * `depth` is bounded to prevent infinite recursion on circular cause
 * references (which the Google SDK has been known to produce).
 */
export function extractSafeGa4ErrorFields(err: unknown, depth = 0): Ga4SafeErrorFields {
  if (depth > 3) return EMPTY_FIELDS;
  if (err == null) return EMPTY_FIELDS;
  if (typeof err !== "object") {
    return { ...EMPTY_FIELDS, message: sanitizeForLog(String(err)) };
  }

  const e = err as Record<string, unknown>;
  const name = safeStringField(e.name);
  const message = safeStringField(e.message);

  const code =
    typeof e.code === "number" || typeof e.code === "string" ? (e.code as number | string) : null;
  const status = safeStringField(e.status);

  const grpcDetails =
    typeof e.details === "string" ? safeStringField(e.details) : null;
  const details =
    grpcDetails ?? safeObjectAsString(e.details);
  const note = safeStringField(e.note);
  const reason = safeStringField(e.reason);
  const domain = safeStringField(e.domain);
  const statusDetails = safeObjectAsString(e.statusDetails);
  const errorInfoMetadata = safeObjectAsString(
    (e as Record<string, unknown>).errorInfoMetadata,
  );
  const metadataHint = extractMetadataHint(e.metadata);

  // googleapis / Gaxios shape — `response.data.error` or top-level `error`.
  let httpStatusText: string | null = null;
  const pullHttpError = (innerErr: unknown): void => {
    if (!innerErr || typeof innerErr !== "object" || httpStatusText) return;
    const innerObj = innerErr as Record<string, unknown>;
    const innerMsg = safeStringField(innerObj.message);
    const innerStatus = safeStringField(innerObj.status);
    const httpCode =
      typeof innerObj.code === "number" || typeof innerObj.code === "string"
        ? String(innerObj.code)
        : null;
    if (innerMsg || innerStatus || httpCode) {
      httpStatusText = sanitizeForLog(
        [innerStatus, httpCode ? `HTTP ${httpCode}` : null, innerMsg].filter(Boolean).join(" — "),
      );
    }
  };
  pullHttpError(e.error);
  const response = e.response;
  if (response && typeof response === "object") {
    const data = (response as Record<string, unknown>).data;
    if (data && typeof data === "object") {
      pullHttpError((data as Record<string, unknown>).error);
    }
  }
  if (!httpStatusText && typeof e.message === "string" && e.message.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(e.message) as Record<string, unknown>;
      pullHttpError(parsed.error);
      if (!httpStatusText) {
        const httpErr = GoogleError.parseHttpError(parsed);
        pullHttpError(httpErr);
      }
    } catch {
      // not JSON — keep existing fields
    }
  }

  let stackFirstLine: string | null = null;
  if (typeof e.stack === "string" && e.stack.length > 0) {
    const first = e.stack.split("\n", 1)[0]?.trim() ?? "";
    if (first.length > 0 && !first.includes(DEGENERATE_GA4_MESSAGE)) {
      stackFirstLine = sanitizeForLog(first);
    }
  }

  // Gaxios / googleapis often attach an `errors` array on the top-level object.
  let errorsHint: string | null = null;
  if (Array.isArray(e.errors) && e.errors.length > 0) {
    errorsHint = safeObjectAsString(e.errors.slice(0, 3));
  }

  // Enumerate own keys so the operator can see what the SDK actually
  // populated even when none of the named fields had useful data.
  let ownKeys: string[] = [];
  try {
    ownKeys = Object.getOwnPropertyNames(e).filter((k) => k !== "stack").slice(0, 20);
  } catch {
    ownKeys = [];
  }

  // Walk the Node-standard `cause` chain. GoogleError + AggregateError both
  // use this. Bounded depth prevents pathological loops.
  let cause: Ga4SafeErrorFields | null = null;
  if (e.cause != null && e.cause !== err) {
    cause = extractSafeGa4ErrorFields(e.cause, depth + 1);
  }

  return {
    name,
    message: message ?? grpcDetails,
    code,
    status,
    details: details ?? errorsHint,
    stackFirstLine,
    note,
    reason,
    domain,
    statusDetails,
    httpStatusText,
    grpcDetails,
    errorInfoMetadata,
    metadataHint,
    ownKeys,
    cause,
  };
}

/** Collect every safe text fragment from a fields tree, including cause. */
function collectAllFragments(f: Ga4SafeErrorFields): string {
  const parts: string[] = [];
  const push = (v: string | null) => {
    if (v) parts.push(v);
  };
  push(f.status);
  push(typeof f.code === "number" || typeof f.code === "string" ? String(f.code) : null);
  push(f.name);
  push(f.message);
  push(f.details);
  push(f.note);
  push(f.reason);
  push(f.domain);
  push(f.statusDetails);
  push(f.httpStatusText);
  push(f.grpcDetails);
  push(f.errorInfoMetadata);
  push(f.metadataHint);
  if (f.cause) parts.push(collectAllFragments(f.cause));
  return parts.join(" ");
}

/**
 * Build the safe human-readable reason string the dashboard renders.
 * Always returns something useful even when the SDK degenerate message
 * was the only field present.
 */
function buildSafeReason(fields: Ga4SafeErrorFields, fallbackOnRawErr: unknown): string {
  const merged = mergeGa4SafeFields(fields);
  const parts: string[] = [];
  if (merged.status) parts.push(merged.status);
  else if (merged.code != null) parts.push(`code=${merged.code}`);
  if (merged.name && merged.name !== "Error" && merged.name !== merged.status) {
    parts.push(merged.name);
  }
  if (merged.httpStatusText) parts.push(merged.httpStatusText);
  else if (merged.message) parts.push(merged.message);
  if (merged.grpcDetails && merged.grpcDetails !== merged.message) parts.push(merged.grpcDetails);
  if (merged.metadataHint) parts.push(merged.metadataHint);
  if (merged.reason) parts.push(merged.reason);
  if (merged.domain) parts.push(merged.domain);
  if (parts.length === 0 && merged.details) parts.push(merged.details);
  if (parts.length === 0 && merged.httpStatusText) parts.push(merged.httpStatusText);
  if (parts.length === 0 && merged.errorInfoMetadata) parts.push(merged.errorInfoMetadata);

  if (parts.length === 0) {
    // Last-resort dump — own property names (includes non-enumerable SDK fields).
    try {
      const shallow: Record<string, unknown> = {};
      if (fallbackOnRawErr && typeof fallbackOnRawErr === "object") {
        const raw = fallbackOnRawErr as Record<string, unknown>;
        for (const k of Object.getOwnPropertyNames(raw)) {
          if (["name", "message", "code", "status", "details", "stack", "metadata"].includes(k)) {
            continue;
          }
          const v = raw[k];
          if (typeof v === "string" || typeof v === "number" || typeof v === "boolean" || v == null) {
            shallow[k] = v;
          }
        }
      }
      const s = JSON.stringify(shallow);
      if (s && s !== "{}") return sanitizeForLog(s);
    } catch {
      // fall through
    }
    return "Unknown GA4 error (no safe fields surfaced).";
  }

  return sanitizeForLog(parts.join(" — "));
}

/** Best-effort classification using structured fields first, then message text. */
function classifyGa4Error(rootFields: Ga4SafeErrorFields): Ga4FailureCode {
  const fields = mergeGa4SafeFields(rootFields);
  // gRPC numeric / textual status — most reliable signal when present.
  const codeNum = typeof fields.code === "number" ? fields.code : null;
  const codeStr = typeof fields.code === "string" ? fields.code.toUpperCase() : null;
  const status = (fields.status ?? "").toUpperCase();

  if (
    status === "PERMISSION_DENIED" ||
    codeNum === 7 ||
    codeNum === 403 ||
    codeStr === "PERMISSION_DENIED" ||
    codeStr === "403"
  ) {
    // Could be either auth or property; the message usually disambiguates.
    const combined = `${fields.message ?? ""} ${fields.details ?? ""}`.toLowerCase();
    if (combined.includes("has not been used") || combined.includes("api is disabled")) {
      return "api_disabled";
    }
    return "property_access_failed";
  }
  if (status === "NOT_FOUND" || codeNum === 5) return "property_access_failed";
  if (status === "INVALID_ARGUMENT" || codeNum === 3) return "property_access_failed";
  if (status === "UNAUTHENTICATED" || codeNum === 16) return "auth_failed";
  if (status === "DEADLINE_EXCEEDED" || codeNum === 4) return "timeout";

  const blob = collectAllFragments(fields).toLowerCase();
  if (blob.length > 0) {
    if (blob.includes("timed out") || blob.includes("deadline")) return "timeout";
    if (
      blob.includes("pem") ||
      blob.includes("decoder routines") ||
      blob.includes("bad decrypt") ||
      blob.includes("invalid key") ||
      blob.includes("asn1") ||
      blob.includes("der") ||
      blob.includes("private_key")
    ) {
      return "key_parse_failed";
    }
    if (
      blob.includes("api has not been used") ||
      blob.includes("api is disabled") ||
      blob.includes("has not been used in project") ||
      blob.includes("analyticsdata.googleapis.com")
    ) {
      return "api_disabled";
    }
    if (
      blob.includes("unauthenticated") ||
      blob.includes("invalid_grant") ||
      blob.includes("invalid grant") ||
      blob.includes("jwt") ||
      blob.includes("signature")
    ) {
      return "auth_failed";
    }
    if (
      blob.includes("permission_denied") ||
      blob.includes("permission denied") ||
      blob.includes("does not have access") ||
      blob.includes("caller does not have permission")
    ) {
      return "property_access_failed";
    }
    if (
      blob.includes("requested entity was not found") ||
      blob.includes("not_found") ||
      blob.includes("invalid property")
    ) {
      return "property_access_failed";
    }
  }
  return "unknown";
}

function labelForFailure(code: Ga4FailureCode): "GA4_KEY_PARSE_FAILED" | "GA4_AUTH_FAILED" | "GA4_PROPERTY_ACCESS_FAILED" | "GA4_FETCH_FAILED" {
  if (code === "key_parse_failed") return "GA4_KEY_PARSE_FAILED";
  if (code === "auth_failed") return "GA4_AUTH_FAILED";
  if (code === "property_access_failed" || code === "api_disabled") return "GA4_PROPERTY_ACCESS_FAILED";
  return "GA4_FETCH_FAILED";
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

function parseMetric(raw: string | null | undefined): number {
  if (raw == null) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

type Ga4LikeValue = { value?: string | null };
type Ga4LikeRow = {
  dimensionValues?: ReadonlyArray<Ga4LikeValue> | null;
  metricValues?: ReadonlyArray<Ga4LikeValue> | null;
};

/** Defensive runtime validation. Drops malformed rows, surfaces issues as warnings. */
function validateAndShape(
  rawRows: ReadonlyArray<unknown>,
): { rows: Ga4PagePathRow[]; droppedCount: number; droppedReasons: string[] } {
  const droppedReasons: string[] = [];
  const rows: Ga4PagePathRow[] = [];

  for (const raw of rawRows) {
    if (!raw || typeof raw !== "object") {
      droppedReasons.push("non_object_row");
      continue;
    }
    const row = raw as Ga4LikeRow;
    const dims = (row.dimensionValues ?? []) as ReadonlyArray<Ga4LikeValue>;
    const mets = (row.metricValues ?? []) as ReadonlyArray<Ga4LikeValue>;
    const pagePath = typeof dims[0]?.value === "string" ? dims[0].value : "";
    if (pagePath.length === 0) {
      droppedReasons.push("empty_page_path");
      continue;
    }
    const sessions = parseMetric(mets[0]?.value);
    const totalUsers = parseMetric(mets[1]?.value);
    const averageSessionDurationSeconds = parseMetric(mets[2]?.value);
    const bounceRate = parseMetric(mets[3]?.value);
    // Cap pathological bounce rates (GA4 occasionally returns >1 for tiny samples).
    const normalisedBounce = bounceRate < 0 ? 0 : bounceRate > 1 ? 1 : bounceRate;
    rows.push({
      pagePath,
      sessions,
      totalUsers,
      averageSessionDurationSeconds,
      bounceRate: normalisedBounce,
    });
  }

  return { rows, droppedCount: droppedReasons.length, droppedReasons };
}

function createGa4DataClient(
  authMode: Ga4AuthMode,
  privateKey: string,
): BetaAnalyticsDataClient {
  // REST fallback avoids @grpc/grpc-js, which loses status fields when
  // bundled by Next/Turbopack (degenerate "undefined undefined: undefined").
  const base = { fallback: true as const };
  if (authMode === "oauth_user") {
    return new BetaAnalyticsDataClient({
      ...base,
      authClient: createGa4OAuth2Client(),
    });
  }
  const env = process.env as Ga4Env;
  return new BetaAnalyticsDataClient({
    ...base,
    credentials: {
      client_email: env.GA4_CLIENT_EMAIL!.trim(),
      private_key: privateKey,
    },
  });
}

export async function fetchTopPagePaths(options: Ga4FetchOptions): Promise<Ga4FetchResult> {
  const state = getGa4ConnectionState();
  if (!state.connected) {
    logSeo("GA4_ENV_MISSING", { missingEnv: state.missingEnv });
    return { ok: false, reason: state.reason, code: "env_missing" };
  }

  const propertyId = state.propertyId;
  const authMode = state.authMode;
  const limit = options.limit ?? DEFAULT_LIMIT;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let privateKey = "";
  if (authMode === "service_account") {
    const env = process.env as Ga4Env;
    const rawKey = env.GA4_PRIVATE_KEY!.trim();
    try {
      privateKey = decodePrivateKey(rawKey);
      if (!privateKey.includes("BEGIN") || !privateKey.includes("PRIVATE KEY")) {
        throw new Error(
          "GA4_PRIVATE_KEY does not contain a PEM header — paste the full key including BEGIN/END lines.",
        );
      }
    } catch (keyErr) {
      const safeFields = extractSafeGa4ErrorFields(keyErr);
      const reason = buildSafeReason(safeFields, keyErr) || "GA4_PRIVATE_KEY could not be decoded.";
      logSeo("GA4_KEY_PARSE_FAILED", { reason, errorName: safeFields.name, authMode });
      return { ok: false, reason, code: "key_parse_failed", safeFields };
    }
  }

  const startedAt = Date.now();
  logSeo("GA4_FETCH_START", {
    propertyId,
    authMode,
    windowStart: options.startDate,
    windowEnd: options.endDate,
    limit,
    timeoutMs,
  });

  try {
    const client = createGa4DataClient(authMode, privateKey);

    const [response] = await withTimeout(
      client.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate: options.startDate, endDate: options.endDate }],
        dimensions: [{ name: "pagePath" }],
        metrics: [
          { name: "sessions" },
          { name: "totalUsers" },
          { name: "averageSessionDuration" },
          { name: "bounceRate" },
        ],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: String(limit),
      }),
      timeoutMs,
      "GA4 fetch",
    );

    if (!response || typeof response !== "object") {
      logSeo("GA4_EMPTY_RESPONSE", { elapsedMs: Date.now() - startedAt });
      return {
        ok: false,
        reason: "GA4 returned an empty response object.",
        code: "empty_response",
      };
    }

    const rawRows = Array.isArray(response.rows) ? response.rows : [];
    const { rows, droppedCount, droppedReasons } = validateAndShape(rawRows);

    if (droppedCount > 0) {
      logSeo("GA4_VALIDATION_WARNING", {
        droppedCount,
        sampleReasons: droppedReasons.slice(0, 5),
        keptCount: rows.length,
      });
    }

    if (rows.length === 0) {
      // Auth + property worked but the window has zero traffic. This is
      // common on a brand-new property and is not a hard failure — log
      // it as an empty response so the operator can tell what happened.
      logSeo("GA4_EMPTY_RESPONSE", {
        propertyId,
        windowStart: options.startDate,
        windowEnd: options.endDate,
        elapsedMs: Date.now() - startedAt,
        note: "Auth + property OK; report contained 0 rows.",
      });
    } else {
      logSeo("GA4_FETCH_SUCCESS", {
        propertyId,
        rowCount: rows.length,
        droppedCount,
        windowStart: options.startDate,
        windowEnd: options.endDate,
        elapsedMs: Date.now() - startedAt,
      });
    }

    return {
      ok: true,
      window: {
        startDate: options.startDate,
        endDate: options.endDate,
        rows,
      },
    };
  } catch (err) {
    logGa4CaughtErrorRaw(err, "before_enrich");
    enrichGa4SdkError(err);
    logGa4CaughtErrorRaw(err, "after_enrich");
    const safeFields = extractSafeGa4ErrorFields(err);
    const code = classifyGa4Error(safeFields);
    const reason = buildSafeReason(safeFields, err);
    const label = labelForFailure(code);
    logSeo(label, {
      reason,
      code,
      authMode,
      // Echo every safe field so the cron log captures the real cause
      // (e.g. PERMISSION_DENIED + "Caller does not have access to property 123").
      errorName: safeFields.name,
      errorMessage: safeFields.message,
      errorCode: safeFields.code,
      errorStatus: safeFields.status,
      errorDetails: safeFields.details,
      stackFirstLine: safeFields.stackFirstLine,
      elapsedMs: Date.now() - startedAt,
      windowStart: options.startDate,
      windowEnd: options.endDate,
    });
    return { ok: false, reason, code, safeFields };
  }
}
