// Compact "data pipeline health" snapshot.
//
// Aggregates the existing readiness signals into a single record the
// /admin/readiness header can render as a small at-a-glance card. The
// fields below are deliberately a subset of what `operational-readiness`
// already computes — we avoid duplicating the heavier check logic, just
// reformat it for the operator who needs a one-line answer per provider.
//
// No HTTP calls. Reads exclusively from env + Supabase + audit rows that
// other parts of the system already maintain.

import { getGa4ConnectionState } from "@/lib/providers/ga4";
import { getSearchConsoleConnectionState } from "@/lib/providers/search-console";
import {
  getLatestGa4Snapshot,
  getLatestGscSnapshot,
} from "@/lib/seo-intelligence/snapshots-store";
import { getSupabaseAdminClient, getSupabaseRuntimeChecks } from "@/lib/supabase-admin";

export type DataPipelineHealth = {
  generatedAt: string;
  ga4: {
    envConfigured: boolean;
    propertyIdPresent: boolean;
    /** `oauth_user` or `service_account` when connected; null when not configured. */
    authMode: "oauth_user" | "service_account" | null;
    /** Only present when env is configured; never echoes the email/key itself. */
    propertyIdHint: string | null;
    latestSnapshotAt: string | null;
    rowCount: number | null;
    /** Sanitised summary of the most recent cron error for GA4, if any. */
    lastErrorSummary: string | null;
  };
  gsc: {
    envConfigured: boolean;
    status: "unavailable" | "pending" | "connected";
    latestSnapshotAt: string | null;
  };
  supabase: {
    reachable: boolean;
    detail: string;
  };
  lastCron: {
    seoSnapshotAt: string | null;
    seoSnapshotStatus: string | null;
  };
};

function sanitizeReason(s: string): string {
  let out = s;
  out = out.replace(/-----BEGIN[\s\S]*?-----END[^-]*-----/gi, "[redacted-pem]");
  out = out.replace(/\b(private[_\s-]?key|client_email)\s*[:=]\s*\S+/gi, "$1=[redacted]");
  out = out.replace(/\bBearer\s+\S+/gi, "Bearer [redacted]");
  if (out.length > 240) out = `${out.slice(0, 237)}...`;
  return out;
}

type AuditRow = { created_at: string; metadata: Record<string, unknown> | null };

async function loadLastSeoCronAudit(): Promise<AuditRow | null> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("admin_audit_logs")
      .select("created_at, metadata")
      .eq("action", "seo_snapshot_run")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return data as AuditRow;
  } catch {
    return null;
  }
}

/** Pull the last error related to GA4 from the most recent cron audit row, if any. */
function extractGa4ErrorSummary(audit: AuditRow | null): string | null {
  if (!audit) return null;
  const meta = audit.metadata;
  if (!meta || typeof meta !== "object") return null;

  // The cron writes the SnapshotRunSummary into metadata; the ga4 leg
  // is at metadata.ga4. We look for { ok:false, reason, code? }.
  const ga4 = (meta as Record<string, unknown>).ga4;
  if (!ga4 || typeof ga4 !== "object") return null;
  const ok = (ga4 as Record<string, unknown>).ok;
  if (ok === true) return null;
  const reason = (ga4 as Record<string, unknown>).reason;
  const code = (ga4 as Record<string, unknown>).code;
  const reasonText = typeof reason === "string" ? reason : "Unknown GA4 error.";
  const codeText = typeof code === "string" ? code : "unknown";
  return sanitizeReason(`[${codeText}] ${reasonText}`);
}

function shortPropertyHint(): string | null {
  const id = process.env.GA4_PROPERTY_ID?.trim();
  if (!id) return null;
  // Show only the last 4 chars to confirm "we read your env var" without
  // disclosing the whole property id (low-sensitivity, but match the
  // same privacy posture as the rest of the system).
  if (id.length <= 4) return `…${id}`;
  return `…${id.slice(-4)}`;
}

export async function buildDataPipelineHealth(): Promise<DataPipelineHealth> {
  const ga4State = getGa4ConnectionState();
  const gscState = getSearchConsoleConnectionState();
  const supabaseChecks = getSupabaseRuntimeChecks();
  const supabaseReachable = supabaseChecks.hasUrl && supabaseChecks.hasServiceRoleKey;

  const [ga4Snap, gscSnap, lastCron] = await Promise.all([
    getLatestGa4Snapshot().catch(() => null),
    getLatestGscSnapshot().catch(() => null),
    loadLastSeoCronAudit(),
  ]);

  const lastCronStatus =
    lastCron?.metadata && typeof lastCron.metadata === "object"
      ? typeof (lastCron.metadata as Record<string, unknown>).status === "string"
        ? ((lastCron.metadata as Record<string, unknown>).status as string)
        : null
      : null;

  return {
    generatedAt: new Date().toISOString(),
    ga4: {
      envConfigured: ga4State.connected,
      propertyIdPresent: Boolean(process.env.GA4_PROPERTY_ID?.trim()),
      authMode: ga4State.connected ? ga4State.authMode : null,
      propertyIdHint: ga4State.connected ? shortPropertyHint() : null,
      latestSnapshotAt: ga4Snap?.createdAt ?? null,
      rowCount: ga4Snap?.rowCount ?? null,
      lastErrorSummary: extractGa4ErrorSummary(lastCron),
    },
    gsc: {
      envConfigured: gscState.connected,
      status: gscState.connected ? "connected" : gscSnap ? "pending" : "unavailable",
      latestSnapshotAt: gscSnap?.createdAt ?? null,
    },
    supabase: {
      reachable: supabaseReachable,
      detail: supabaseReachable
        ? `Reachable (${supabaseChecks.urlHost ?? "host configured"})`
        : "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.",
    },
    lastCron: {
      seoSnapshotAt: lastCron?.created_at ?? null,
      seoSnapshotStatus: lastCronStatus,
    },
  };
}
