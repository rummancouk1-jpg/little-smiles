import { type NextRequest, NextResponse } from "next/server";

import { logSystemAudit } from "@/lib/admin-audit";
import { getCronAuthDebug, isAuthorizedCronRequest } from "@/lib/cron-auth";
import { captureServerError } from "@/lib/error-observability";
import {
  fetchTopPagePaths,
  getGa4ConnectionState,
  type Ga4AuthMode,
  type Ga4SafeErrorFields,
} from "@/lib/providers/ga4";
import { getSearchConsoleConnectionState } from "@/lib/providers/search-console";
import {
  runSnapshotPipeline,
  type ProviderOutcome,
  type SnapshotRunSummary,
} from "@/lib/seo-intelligence/snapshot-pipeline";
import {
  getLatestGa4Snapshot,
  pruneOldGa4Snapshots,
  upsertGa4Snapshot,
} from "@/lib/seo-intelligence/snapshots-store";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

type ProviderEnvValidation = {
  configured: boolean;
  missing: string[];
};

type SeoSnapshotEnvValidation = {
  gsc: ProviderEnvValidation;
  ga4: ProviderEnvValidation;
  supabase: ProviderEnvValidation;
};

function sanitizeSafeMessage(message: string): string {
  let s = message.trim();
  s = s.replace(/-----BEGIN[\s\S]*?-----END[^-]*-----/gi, "[redacted]");
  s = s.replace(/\b(private[_\s-]?key|client_email|Bearer\s+)\S+/gi, "[redacted]");
  if (s.length > 500) {
    s = `${s.slice(0, 497)}...`;
  }
  return s;
}

function safeErrorMessage(err: unknown): string {
  return sanitizeSafeMessage(err instanceof Error ? err.message : "Unknown error");
}

function buildEnvValidation(): SeoSnapshotEnvValidation {
  const gscState = getSearchConsoleConnectionState();
  const ga4State = getGa4ConnectionState();
  const hasSupabase = Boolean(getSupabaseAdminClient());

  return {
    gsc: {
      configured: gscState.connected,
      missing: gscState.connected ? [] : gscState.missingEnv,
    },
    ga4: {
      configured: ga4State.connected,
      missing: ga4State.connected ? [] : ga4State.missingEnv,
    },
    supabase: {
      configured: hasSupabase,
      missing: hasSupabase ? [] : ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
    },
  };
}

function isSupabaseInsertFailure(outcome: ProviderOutcome): boolean {
  if (outcome.ok || outcome.skipped) return false;
  return /Failed to upsert|Persist failed|Supabase admin client is not configured/i.test(outcome.reason);
}

function logProviderFailures(summary: SnapshotRunSummary, envValidation: SeoSnapshotEnvValidation): void {
  if (!summary.gsc.ok && !summary.gsc.skipped) {
    const reason = sanitizeSafeMessage(summary.gsc.reason);
    if (isSupabaseInsertFailure(summary.gsc)) {
      console.error("SEO_SNAPSHOT_SUPABASE_INSERT_FAILED", { provider: "gsc", reason });
    } else if (envValidation.gsc.missing.length > 0) {
      console.error("SEO_SNAPSHOT_ENV_VALIDATION_FAILED", {
        provider: "gsc",
        missing: envValidation.gsc.missing,
      });
    } else {
      console.error("SEO_SNAPSHOT_GSC_FAILED", { reason });
    }
  }

  if (!summary.ga4.ok && !summary.ga4.skipped) {
    const reason = sanitizeSafeMessage(summary.ga4.reason);
    if (isSupabaseInsertFailure(summary.ga4)) {
      console.error("SEO_SNAPSHOT_SUPABASE_INSERT_FAILED", { provider: "ga4", reason });
    } else if (envValidation.ga4.missing.length > 0) {
      console.error("SEO_SNAPSHOT_ENV_VALIDATION_FAILED", {
        provider: "ga4",
        missing: envValidation.ga4.missing,
      });
    } else {
      console.error("SEO_SNAPSHOT_GA4_FAILED", { reason });
    }
  }
}

function cronOk(summary: SnapshotRunSummary): boolean {
  return summary.status === "ok" || summary.status === "completed_with_warnings" || summary.status === "skipped";
}

function classifyTrigger(request: NextRequest): "scheduled_cron" | "manual" {
  // Vercel sets x-vercel-cron when the scheduler invokes the route. Any
  // other source — operator browser, curl, integration test — counts as
  // a manual trigger for the audit row.
  if (request.headers.get("x-vercel-cron")) return "scheduled_cron";
  return "manual";
}

export async function GET(request: NextRequest) {
  console.error("SEO_SNAPSHOT_CRON_START");

  try {
    const authDebug = getCronAuthDebug(request);
    const triggerKind = classifyTrigger(request);

    if (request.nextUrl.searchParams.get("debug_auth") === "1") {
      return NextResponse.json({
        ok: false,
        status: "auth_debug",
        authorized: isAuthorizedCronRequest(request),
        authDebug,
      });
    }

    const cronSecret = process.env.CRON_SECRET?.trim();
    if (!cronSecret) {
      console.error("SEO_SNAPSHOT_ENV_VALIDATION_FAILED", { missing: ["CRON_SECRET"] });
      return NextResponse.json(
        {
          ok: false,
          status: "configuration_error",
          error: "CRON_SECRET is not configured.",
          missingEnv: ["CRON_SECRET"],
          authDebug,
        },
        { status: 503 },
      );
    }

    if (!isAuthorizedCronRequest(request)) {
      return NextResponse.json(
        {
          ok: false,
          status: "unauthorized",
          error: "Unauthorized cron request.",
          authDebug,
        },
        { status: 401 },
      );
    }

    // Protected GA4-only diagnostic mode. Bypasses GSC and the regular
    // response shape so an operator can answer "is GA4 actually
    // returning data, and does Supabase accept it?" in one HTTP call.
    // Writes a small audit row (no secrets) so operators can see who
    // ran the debug and what the classifier returned.
    if (request.nextUrl.searchParams.get("debug") === "ga4") {
      const ga4Diag = await runGa4DiagnosticOnly();
      await logSystemAudit({
        action: "ga4_debug_run",
        metadata: {
          ok: ga4Diag.ok,
          likelyCause: ga4Diag.likelyCause,
          rowsReturned: ga4Diag.ga4.rowsReturned,
          snapshotInserted: ga4Diag.ga4.snapshotInserted,
          authMode: ga4Diag.ga4.authMode,
          failureCode: ga4Diag.ga4.failureCode,
          smokeWindows: ga4Diag.ga4.smokeWindows.map((w) => ({
            label: w.label,
            ok: w.ok,
            rows: w.rowsReturned,
          })),
        },
      }).catch(() => {});
      return NextResponse.json(ga4Diag, { status: ga4Diag.ok ? 200 : 200 });
    }

    const envValidation = buildEnvValidation();

    if (envValidation.gsc.missing.length > 0 || envValidation.ga4.missing.length > 0) {
      console.error("SEO_SNAPSHOT_ENV_VALIDATION_FAILED", {
        gscMissing: envValidation.gsc.missing,
        ga4Missing: envValidation.ga4.missing,
      });
    }

    if (!envValidation.supabase.configured) {
      console.error("SEO_SNAPSHOT_ENV_VALIDATION_FAILED", {
        missing: envValidation.supabase.missing,
      });
      return NextResponse.json(
        {
          ok: false,
          status: "configuration_error",
          error: "Supabase is not configured — snapshot persistence requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
          missingEnv: envValidation.supabase.missing,
          envValidation,
        },
        { status: 503 },
      );
    }

    let summary: SnapshotRunSummary;
    try {
      summary = await runSnapshotPipeline();
    } catch (err) {
      const reason = safeErrorMessage(err);
      captureServerError("api_cron_seo_snapshot_failed", err);
      if (/supabase|upsert|persist/i.test(reason)) {
        console.error("SEO_SNAPSHOT_SUPABASE_INSERT_FAILED", { reason });
      } else if (/ga4/i.test(reason)) {
        console.error("SEO_SNAPSHOT_GA4_FAILED", { reason });
      } else if (/gsc|search console/i.test(reason)) {
        console.error("SEO_SNAPSHOT_GSC_FAILED", { reason });
      } else {
        console.error("SEO_SNAPSHOT_GSC_FAILED", { reason });
      }
      await logSystemAudit({
        action: "seo_snapshot_run",
        actorLabel: triggerKind === "manual" ? "manual_trigger" : "system_cron",
        metadata: { status: "error", reason, triggerKind },
      }).catch(() => {});
      return NextResponse.json(
        {
          ok: false,
          status: "pipeline_error",
          error: reason,
          envValidation,
        },
        { status: 500 },
      );
    }

    logProviderFailures(summary, envValidation);

    const supabaseInsertErrors: Array<{ provider: "gsc" | "ga4"; message: string }> = [];
    if (!summary.gsc.ok && isSupabaseInsertFailure(summary.gsc)) {
      supabaseInsertErrors.push({
        provider: "gsc",
        message: sanitizeSafeMessage(summary.gsc.reason),
      });
    }
    if (!summary.ga4.ok && isSupabaseInsertFailure(summary.ga4)) {
      supabaseInsertErrors.push({
        provider: "ga4",
        message: sanitizeSafeMessage(summary.ga4.reason),
      });
    }

    await logSystemAudit({
      action: "seo_snapshot_run",
      actorLabel: triggerKind === "manual" ? "manual_trigger" : "system_cron",
      metadata: {
        status: summary.status,
        triggerKind,
        warnings: summary.warnings,
        windowStart: summary.windowStart,
        windowEnd: summary.windowEnd,
        gsc: summary.gsc,
        ga4: summary.ga4,
        envValidation: {
          gscMissing: envValidation.gsc.missing,
          ga4Missing: envValidation.ga4.missing,
        },
      },
    }).catch((auditErr) => {
      console.error("SEO_SNAPSHOT audit log failed (non-fatal)", safeErrorMessage(auditErr));
    });

    console.error("SEO_SNAPSHOT_SUCCESS", {
      status: summary.status,
      gscOk: summary.gsc.ok,
      ga4Ok: summary.ga4.ok,
      warningCount: summary.warnings.length,
    });

    return NextResponse.json(
      {
        ok: cronOk(summary),
        emailNotification: { sent: false, skipped: true, reason: "SEO snapshot cron does not send email." },
        envValidation,
        supabaseInsertErrors,
        ...summary,
      },
      { status: 200 },
    );
  } catch (err) {
    const reason = safeErrorMessage(err);
    captureServerError("api_cron_seo_snapshot_unhandled", err);
    if (/supabase|upsert|persist/i.test(reason)) {
      console.error("SEO_SNAPSHOT_SUPABASE_INSERT_FAILED", { reason, phase: "unhandled_handler" });
    } else if (/ga4/i.test(reason)) {
      console.error("SEO_SNAPSHOT_GA4_FAILED", { reason, phase: "unhandled_handler" });
    } else {
      console.error("SEO_SNAPSHOT_GSC_FAILED", { reason, phase: "unhandled_handler" });
    }
    return NextResponse.json(
      {
        ok: false,
        status: "unhandled_error",
        error: reason,
      },
      { status: 500 },
    );
  }
}

/**
 * Operator-readable classifier the debug endpoint and the readiness
 * dashboard branch on. Distinguishes the five real outcomes the system
 * actually sees in production:
 *
 *   - ga4_working                          — at least one window returned rows
 *   - reporting_delay_or_no_historical_rows — auth + property OK but every
 *                                              window has zero rows
 *   - property_has_no_data                 — same as above but the 90-day
 *                                              window is also empty (very
 *                                              likely a brand-new property)
 *   - wrong_measurement_id                 — property access failed at SDK
 *   - auth_failed                          — SDK auth failure
 *   - env_missing                          — env vars not set
 *   - supabase_insert_failed               — fetch OK, persistence failed
 *   - unknown                              — none of the above
 */
type Ga4LikelyCause =
  | "ga4_working"
  | "reporting_delay_or_no_historical_rows"
  | "property_has_no_data"
  | "wrong_measurement_id"
  | "auth_failed"
  | "env_missing"
  | "supabase_insert_failed"
  | "unknown";

type Ga4SmokeWindowResult = {
  label: "primary_28d" | "smoke_7d" | "smoke_30d" | "smoke_90d";
  startDate: string;
  endDate: string;
  ok: boolean;
  rowsReturned: number | null;
  failureCode: string | null;
  reason: string | null;
};

type Ga4DiagnosticResponse = {
  ok: boolean;
  likelyCause: Ga4LikelyCause;
  ga4: {
    envConfigured: boolean;
    propertyIdPresent: boolean;
    authMode: Ga4AuthMode | null;
    authOk: boolean | null;
    /** Rows from the primary 28-day window — the one the cron also writes. */
    rowsReturned: number | null;
    snapshotInserted: boolean;
    latestSnapshotAt: string | null;
    failureCode: string | null;
    reason: string | null;
    /** Structured SDK error fields (includes nested `cause` when present). */
    errorFields?: Ga4SafeErrorFields;
    /** Primary window the snapshot was taken against. */
    primaryWindow: { startDate: string; endDate: string };
    /** Lightweight follow-up smoke queries — each one is independent. */
    smokeWindows: Ga4SmokeWindowResult[];
  };
  warnings: string[];
};

function isoDateNDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

async function runSmokeWindow(
  label: Ga4SmokeWindowResult["label"],
  startDate: string,
  endDate: string,
): Promise<Ga4SmokeWindowResult> {
  const result = await fetchTopPagePaths({ startDate, endDate, limit: 5 });
  if (!result.ok) {
    return {
      label,
      startDate,
      endDate,
      ok: false,
      rowsReturned: null,
      failureCode: result.code,
      reason: sanitizeSafeMessage(result.reason),
    };
  }
  return {
    label,
    startDate,
    endDate,
    ok: true,
    rowsReturned: result.window.rows.length,
    failureCode: null,
    reason: null,
  };
}

async function runGa4DiagnosticOnly(): Promise<Ga4DiagnosticResponse> {
  const warnings: string[] = [];
  const state = getGa4ConnectionState();

  if (!state.connected) {
    return {
      ok: false,
      likelyCause: "env_missing",
      ga4: {
        envConfigured: false,
        propertyIdPresent: Boolean(process.env.GA4_PROPERTY_ID?.trim()),
        authMode: null,
        authOk: null,
        rowsReturned: null,
        snapshotInserted: false,
        latestSnapshotAt: null,
        failureCode: "env_missing",
        reason: sanitizeSafeMessage(state.reason),
        primaryWindow: { startDate: "", endDate: "" },
        smokeWindows: [],
      },
      warnings: [`Missing env: ${state.missingEnv.join(", ")}`],
    };
  }

  const windowEnd = isoDateNDaysAgo(1);
  const windowStart = isoDateNDaysAgo(28);

  const fetchResult = await fetchTopPagePaths({ startDate: windowStart, endDate: windowEnd });
  if (!fetchResult.ok) {
    const authOk =
      fetchResult.code === "auth_failed" || fetchResult.code === "key_parse_failed"
        ? false
        : fetchResult.code === "property_access_failed" || fetchResult.code === "api_disabled"
          ? true
          : null;
    const likelyCause: Ga4LikelyCause =
      fetchResult.code === "auth_failed" || fetchResult.code === "key_parse_failed"
        ? "auth_failed"
        : fetchResult.code === "property_access_failed" || fetchResult.code === "api_disabled"
          ? "wrong_measurement_id"
          : "unknown";
    return {
      ok: false,
      likelyCause,
      ga4: {
        envConfigured: true,
        propertyIdPresent: true,
        authMode: state.authMode,
        authOk,
        rowsReturned: null,
        snapshotInserted: false,
        latestSnapshotAt: null,
        failureCode: fetchResult.code,
        reason: sanitizeSafeMessage(fetchResult.reason),
        errorFields: fetchResult.safeFields,
        primaryWindow: { startDate: windowStart, endDate: windowEnd },
        smokeWindows: [],
      },
      warnings,
    };
  }

  const rowsReturned = fetchResult.window.rows.length;
  if (rowsReturned === 0) {
    warnings.push(
      "GA4 returned 0 rows for the primary 28-day window — auth + property are working. Standard reports have a 24-48h delay; smoke queries below check wider/narrower windows.",
    );
  }

  // Independent smoke queries — each surfaces row counts for a different
  // window so the operator can disambiguate "delay vs no data" without
  // waiting for the next cron tick. Limited to 5 rows for cheap-ness.
  const smokeWindows = await Promise.all([
    runSmokeWindow("smoke_7d", isoDateNDaysAgo(7), isoDateNDaysAgo(1)),
    runSmokeWindow("smoke_30d", isoDateNDaysAgo(30), isoDateNDaysAgo(1)),
    runSmokeWindow("smoke_90d", isoDateNDaysAgo(90), isoDateNDaysAgo(1)),
  ]);

  let snapshotInserted = false;
  let supabaseFailed = false;
  let latestSnapshotAt: string | null = null;
  try {
    const stored = await upsertGa4Snapshot(fetchResult.window);
    snapshotInserted = true;
    latestSnapshotAt = stored.createdAt;
    await pruneOldGa4Snapshots().catch(() => 0);
  } catch (err) {
    supabaseFailed = true;
    warnings.push(`Supabase upsert failed: ${sanitizeSafeMessage(err instanceof Error ? err.message : "unknown")}`);
  }

  if (!latestSnapshotAt) {
    // Best-effort follow-up read; some failures still leave the most-recent
    // row intact and an operator wants to see it.
    const latest = await getLatestGa4Snapshot().catch(() => null);
    latestSnapshotAt = latest?.createdAt ?? null;
  }

  const anySmokeHasRows = smokeWindows.some((w) => w.ok && (w.rowsReturned ?? 0) > 0);
  const ninetyDay = smokeWindows.find((w) => w.label === "smoke_90d");
  const ninetyDayHasRows = Boolean(ninetyDay?.ok && (ninetyDay?.rowsReturned ?? 0) > 0);

  let likelyCause: Ga4LikelyCause;
  if (supabaseFailed) {
    likelyCause = "supabase_insert_failed";
  } else if (rowsReturned > 0 || anySmokeHasRows) {
    likelyCause = "ga4_working";
  } else if (ninetyDay?.ok && !ninetyDayHasRows) {
    likelyCause = "property_has_no_data";
  } else {
    likelyCause = "reporting_delay_or_no_historical_rows";
  }

  return {
    ok: snapshotInserted && (rowsReturned > 0 || anySmokeHasRows),
    likelyCause,
    ga4: {
      envConfigured: true,
      propertyIdPresent: true,
      authMode: state.authMode,
      authOk: true,
      rowsReturned,
      snapshotInserted,
      latestSnapshotAt,
      failureCode: null,
      reason: null,
      primaryWindow: { startDate: windowStart, endDate: windowEnd },
      smokeWindows,
    },
    warnings,
  };
}
