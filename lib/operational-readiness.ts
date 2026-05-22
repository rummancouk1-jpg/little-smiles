// Operational readiness diagnostics. Pure config-level checks plus
// lightweight Supabase reads where data already lives. No external
// HTTP calls to providers — each check should be safe to run from a
// server-rendered admin page without adding deployment risk.
//
// Honest by design: if a provider is not configured, the panel says
// so and tells the operator which env var is missing. There are no
// fabricated metrics or "intelligence" scores here.

import { currentAdminAuthMode } from "@/lib/admin-identity";
import { isAdminAuthConfigured } from "@/lib/admin-runtime";
import { littleSmilesPublishAdapter } from "@/lib/blog-publish-adapter";
import { listDrafts } from "@/lib/contentops/drafts-store";
import { validateDraftSchema } from "@/lib/contentops/publish-prep";
import { getGa4ConnectionState } from "@/lib/providers/ga4";
import { getSearchConsoleConnectionState } from "@/lib/providers/search-console";
import {
  getLatestGa4Snapshot,
  getLatestGscSnapshot,
} from "@/lib/seo-intelligence/snapshots-store";
import { getSupabaseAdminClient, getSupabaseRuntimeChecks } from "@/lib/supabase-admin";

export type ReadinessLevel = "ready" | "warning" | "missing";

export type ReadinessItem = {
  label: string;
  level: ReadinessLevel;
  detail: string;
};

export type ProviderReport = {
  key: string;
  label: string;
  items: ReadinessItem[];
};

export type CronRunReport = {
  action: string;
  label: string;
  expectedScheduleUtc: string;
  level: ReadinessLevel;
  lastRunAt: string | null;
  lastRunSummary: Record<string, unknown> | null;
  detail: string;
};

export type ContentOpsQueueReport = {
  level: ReadinessLevel;
  detail: string;
  counts: Record<"pending_review" | "approved" | "rejected" | "published", number>;
  approvedReadyToPublish: number;
  approvedWithSchemaIssues: number;
  approvedMissingHeroImage: number;
};

export type SnapshotFreshnessReport = {
  label: string;
  level: ReadinessLevel;
  snapshotDate: string | null;
  ageDays: number | null;
  rowCount: number | null;
  detail: string;
};

export type ReadinessReport = {
  generatedAt: string;
  providers: ProviderReport[];
  crons: CronRunReport[];
  snapshotFreshness: SnapshotFreshnessReport[];
  contentops: ContentOpsQueueReport | null;
  contentopsError: string | null;
  seo: ProviderReport;
};

function envPresent(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

function ok(label: string, detail: string): ReadinessItem {
  return { label, level: "ready", detail };
}
function warn(label: string, detail: string): ReadinessItem {
  return { label, level: "warning", detail };
}
function missing(label: string, detail: string): ReadinessItem {
  return { label, level: "missing", detail };
}

function gaIdLooksValid(value: string): boolean {
  return /^G-[A-Z0-9]+$/i.test(value.trim());
}

function supabaseProvider(): ProviderReport {
  const checks = getSupabaseRuntimeChecks();
  const items: ReadinessItem[] = [];

  items.push(
    checks.hasUrl
      ? ok("SUPABASE_URL", checks.urlHost ? `Host: ${checks.urlHost}` : "Set")
      : missing("SUPABASE_URL", "Required for orders, intents, audit, ContentOps drafts."),
  );

  if (checks.hasUrl && !checks.urlIsValid) {
    items.push(warn("SUPABASE_URL format", "Value is set but is not a valid URL."));
  }
  if (checks.hadPathSuffix) {
    items.push(
      warn(
        "SUPABASE_URL path suffix",
        "URL includes a path component (e.g. /rest/v1). The client normalises to the origin, but consider cleaning the env var.",
      ),
    );
  }

  items.push(
    checks.hasServiceRoleKey
      ? ok("SUPABASE_SERVICE_ROLE_KEY", "Set")
      : missing("SUPABASE_SERVICE_ROLE_KEY", "Required for server-side reads/writes."),
  );

  return { key: "supabase", label: "Supabase", items };
}

function resendProvider(): ProviderReport {
  const items: ReadinessItem[] = [];
  const hasKey = envPresent("RESEND_API_KEY");
  items.push(
    hasKey
      ? ok("RESEND_API_KEY", "Set")
      : warn("RESEND_API_KEY", "Email delivery (contact form + ContentOps digest) is disabled until set."),
  );

  const to = process.env.CONTACT_TO_EMAIL?.trim();
  const from = process.env.CONTACT_FROM_EMAIL?.trim();
  items.push(
    to ? ok("CONTACT_TO_EMAIL", to) : missing("CONTACT_TO_EMAIL", "Recipient for contact form is unset."),
  );
  items.push(
    from ? ok("CONTACT_FROM_EMAIL", from) : missing("CONTACT_FROM_EMAIL", "Verified sender required."),
  );

  const digestTo = process.env.CONTENTOPS_DIGEST_TO?.trim();
  if (digestTo) {
    items.push(ok("CONTENTOPS_DIGEST_TO", digestTo));
  } else if (to) {
    items.push(warn("CONTENTOPS_DIGEST_TO", `Unset — digest will fall back to CONTACT_TO_EMAIL (${to}).`));
  } else {
    items.push(missing("CONTENTOPS_DIGEST_TO", "Set this or CONTACT_TO_EMAIL so reviewer receives daily digest."));
  }

  return { key: "resend", label: "Resend (email)", items };
}

function gaProvider(): ProviderReport {
  const items: ReadinessItem[] = [];
  const raw = process.env.NEXT_PUBLIC_GA_ID?.trim();
  if (!raw) {
    items.push(warn("NEXT_PUBLIC_GA_ID", "GA4 tag is not injected. Set to a G-XXXXXXXXXX measurement ID."));
  } else if (!gaIdLooksValid(raw)) {
    items.push(missing("NEXT_PUBLIC_GA_ID", `Value "${raw}" does not match G-XXXXXXXXXX. Tag will be skipped.`));
  } else {
    items.push(ok("NEXT_PUBLIC_GA_ID", `Active: ${raw}`));
  }
  return { key: "ga4", label: "Google Analytics 4", items };
}

function sentryProvider(): ProviderReport {
  const items: ReadinessItem[] = [];
  const serverDsn = process.env.SENTRY_DSN?.trim();
  const publicDsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
  if (serverDsn || publicDsn) {
    items.push(ok("SENTRY DSN", serverDsn ? "SENTRY_DSN set" : "NEXT_PUBLIC_SENTRY_DSN set (client only)"));
  } else {
    items.push(warn("SENTRY DSN", "No DSN set. Server errors and unhandled exceptions will not be reported."));
  }
  const org = process.env.SENTRY_ORG?.trim();
  const project = process.env.SENTRY_PROJECT?.trim();
  if (!org || !project) {
    items.push(
      warn(
        "Sentry source maps",
        "SENTRY_ORG / SENTRY_PROJECT not set — production stack traces will not be symbolicated.",
      ),
    );
  }
  return { key: "sentry", label: "Sentry", items };
}

function cronProvider(): ProviderReport {
  const items: ReadinessItem[] = [];
  items.push(
    envPresent("CRON_SECRET")
      ? ok("CRON_SECRET", "Set — Vercel Cron will be authenticated.")
      : missing("CRON_SECRET", "Cron endpoints will refuse all requests until set."),
  );
  return { key: "cron", label: "Cron auth", items };
}

function adminProvider(): ProviderReport {
  const items: ReadinessItem[] = [];
  const mode = currentAdminAuthMode();
  items.push(ok("ADMIN_AUTH_MODE", `mode = ${mode}`));
  if (isAdminAuthConfigured()) {
    items.push(ok("Credentials", mode === "supabase" ? "SUPABASE_ANON_KEY set" : "ADMIN_SECRET set"));
  } else {
    items.push(missing("Credentials", mode === "supabase" ? "SUPABASE_ANON_KEY required" : "ADMIN_SECRET required"));
  }
  return { key: "admin", label: "Admin auth", items };
}

function searchConsoleProvider(): ProviderReport {
  const state = getSearchConsoleConnectionState();
  const items: ReadinessItem[] = [];
  if (state.connected) {
    items.push(ok("Search Console", `Site ${state.siteUrl} · service-account ${state.clientEmail}`));
  } else {
    items.push(warn("Search Console", state.reason));
    for (const key of state.missingEnv) {
      items.push(missing(key, "Required for query / impression / CTR signals."));
    }
  }
  return { key: "gsc", label: "Search Console (future)", items };
}

function ga4DataApiProvider(): ProviderReport {
  const state = getGa4ConnectionState();
  const items: ReadinessItem[] = [];
  if (state.connected) {
    const authLabel =
      state.authMode === "oauth_user"
        ? "OAuth user"
        : `service account (${process.env.GA4_CLIENT_EMAIL?.trim() ?? "configured"})`;
    items.push(ok("GA4 Data API", `Property ${state.propertyId} · ${authLabel}`));
  } else {
    items.push(warn("GA4 Data API", state.reason));
    for (const key of state.missingEnv) {
      items.push(missing(key, "Required for traffic / engagement signals."));
    }
  }
  return { key: "ga4-data-api", label: "GA4 Data API (future)", items };
}

function anthropicProvider(): ProviderReport {
  const items: ReadinessItem[] = [];
  const hasKey = envPresent("ANTHROPIC_API_KEY");
  if (hasKey) {
    items.push(ok("ANTHROPIC_API_KEY", "Set — local `npm run contentops:draft` will work."));
    items.push(
      warn(
        "Production scope",
        "Anthropic is intentionally local-only (CLI draft generation). Deployed runtime does not call it.",
      ),
    );
  } else {
    items.push(
      warn(
        "ANTHROPIC_API_KEY",
        "Unset. Local draft generation will fail; production runtime is unaffected.",
      ),
    );
  }
  return { key: "anthropic", label: "Anthropic (local CLI only)", items };
}

function seoChecks(): ProviderReport {
  const items: ReadinessItem[] = [];
  items.push(ok("sitemap", "/sitemap.xml served by app/sitemap.ts (static + products + blog)."));
  items.push(ok("robots", "/robots.txt blocks /api/ and /admin/, declares sitemap."));
  items.push(ok("canonical host", "Middleware 301s littlesmiles.co → www.littlesmiles.co for SEO consolidation."));
  items.push(ok("structured data", "Organization, WebSite, Product, BlogPosting, FAQ, Breadcrumb JSON-LD generators wired."));
  const verification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim();
  items.push(
    verification
      ? ok("Search Console verification", "Meta tag value present.")
      : warn(
          "Search Console verification",
          "No NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION set — verify via DNS or upload file instead.",
        ),
  );
  return { key: "seo", label: "SEO surfaces", items };
}

type AuditRow = {
  created_at: string;
  metadata: Record<string, unknown> | null;
};

async function loadLastAuditRow(action: string): Promise<AuditRow | null> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("admin_audit_logs")
    .select("created_at, metadata")
    .eq("action", action)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data as AuditRow;
}

function cronHealthLevel(lastRunAt: string | null, maxAgeHours: number): ReadinessLevel {
  if (!lastRunAt) return "missing";
  const last = new Date(lastRunAt).getTime();
  if (!Number.isFinite(last)) return "warning";
  const ageHours = (Date.now() - last) / 3_600_000;
  if (ageHours <= maxAgeHours) return "ready";
  return "warning";
}

function formatAgeDetail(lastRunAt: string | null, expectedScheduleUtc: string): string {
  if (!lastRunAt) return `No run logged yet. Schedule: ${expectedScheduleUtc} (UTC).`;
  const last = new Date(lastRunAt).getTime();
  if (!Number.isFinite(last)) return `Latest timestamp invalid. Schedule: ${expectedScheduleUtc} (UTC).`;
  const ageMinutes = Math.floor((Date.now() - last) / 60_000);
  if (ageMinutes < 60) return `Last run ${ageMinutes} minute${ageMinutes === 1 ? "" : "s"} ago.`;
  const ageHours = Math.floor(ageMinutes / 60);
  return `Last run ${ageHours} hour${ageHours === 1 ? "" : "s"} ago.`;
}

async function buildCronReport(input: {
  action: string;
  label: string;
  expectedScheduleUtc: string;
  maxAgeHours: number;
}): Promise<CronRunReport> {
  const row = await loadLastAuditRow(input.action).catch(() => null);
  const lastRunAt = row?.created_at ?? null;
  const level = cronHealthLevel(lastRunAt, input.maxAgeHours);
  return {
    action: input.action,
    label: input.label,
    expectedScheduleUtc: input.expectedScheduleUtc,
    level,
    lastRunAt,
    lastRunSummary: row?.metadata ?? null,
    detail: formatAgeDetail(lastRunAt, input.expectedScheduleUtc),
  };
}

async function buildContentOpsReport(): Promise<{ report: ContentOpsQueueReport | null; error: string | null }> {
  try {
    const [pending, approved, rejected, published] = await Promise.all([
      listDrafts("pending_review"),
      listDrafts("approved"),
      listDrafts("rejected"),
      listDrafts("published"),
    ]);

    let approvedReady = 0;
    let approvedWithSchemaIssues = 0;
    let approvedMissingHero = 0;

    for (const draft of approved) {
      const schema = validateDraftSchema(draft);
      if (!schema.schemaValid) {
        approvedWithSchemaIssues += 1;
        continue;
      }
      const insertion = littleSmilesPublishAdapter.buildInsertionObject(draft);
      const imageReport = littleSmilesPublishAdapter.reportImageAvailability(insertion);
      if (!imageReport.ok) {
        approvedMissingHero += 1;
        continue;
      }
      approvedReady += 1;
    }

    const totalApproved = approved.length;
    let level: ReadinessLevel = "ready";
    let detail = "Queue counts loaded.";
    if (totalApproved === 0 && pending.length === 0) {
      detail = "No drafts in flight. Generate one with `npm run contentops:draft`.";
    } else if (approvedWithSchemaIssues > 0) {
      level = "warning";
      detail = `${approvedWithSchemaIssues} approved draft(s) fail schema validation.`;
    } else if (approvedMissingHero > 0) {
      level = "warning";
      detail = `${approvedMissingHero} approved draft(s) have no anchor product for hero image.`;
    }

    return {
      report: {
        level,
        detail,
        counts: {
          pending_review: pending.length,
          approved: approved.length,
          rejected: rejected.length,
          published: published.length,
        },
        approvedReadyToPublish: approvedReady,
        approvedWithSchemaIssues,
        approvedMissingHeroImage: approvedMissingHero,
      },
      error: null,
    };
  } catch (err) {
    return { report: null, error: err instanceof Error ? err.message : "Failed to load drafts." };
  }
}

export async function buildReadinessReport(): Promise<ReadinessReport> {
  const providers: ProviderReport[] = [
    supabaseProvider(),
    resendProvider(),
    gaProvider(),
    sentryProvider(),
    cronProvider(),
    adminProvider(),
    searchConsoleProvider(),
    ga4DataApiProvider(),
    anthropicProvider(),
  ];

  const [
    communicationsRetries,
    contentopsDigest,
    seoSnapshot,
    contentopsResult,
    gscSnap,
    ga4Snap,
  ] = await Promise.all([
    buildCronReport({
      action: "order_communication_auto_retry_run",
      label: "Order communications retry",
      expectedScheduleUtc: "0 12 * * *",
      maxAgeHours: 26,
    }),
    buildCronReport({
      action: "contentops_digest_run",
      label: "ContentOps daily digest",
      expectedScheduleUtc: "30 15 * * * (20:30 PKT)",
      maxAgeHours: 26,
    }),
    buildCronReport({
      action: "seo_snapshot_run",
      label: "SEO snapshot (GSC + GA4)",
      expectedScheduleUtc: "0 6 * * *",
      maxAgeHours: 26,
    }),
    buildContentOpsReport(),
    getLatestGscSnapshot().catch(() => null),
    getLatestGa4Snapshot().catch(() => null),
  ]);

  const snapshotFreshness: SnapshotFreshnessReport[] = [
    buildSnapshotFreshness("Search Console snapshot", gscSnap),
    buildSnapshotFreshness("GA4 snapshot", ga4Snap),
  ];

  return {
    generatedAt: new Date().toISOString(),
    providers,
    crons: [communicationsRetries, contentopsDigest, seoSnapshot],
    snapshotFreshness,
    contentops: contentopsResult.report,
    contentopsError: contentopsResult.error,
    seo: seoChecks(),
  };
}

function buildSnapshotFreshness(
  label: string,
  snapshot: { snapshotDate: string; rowCount: number } | null,
): SnapshotFreshnessReport {
  if (!snapshot) {
    return {
      label,
      level: "missing",
      snapshotDate: null,
      ageDays: null,
      rowCount: null,
      detail: "No snapshot row yet. Provider may not be connected, or the cron has not run successfully.",
    };
  }
  const t = new Date(`${snapshot.snapshotDate}T00:00:00Z`).getTime();
  const ageDays = Number.isFinite(t) ? Math.floor((Date.now() - t) / 86_400_000) : null;
  let level: ReadinessLevel = "ready";
  if (ageDays === null) level = "warning";
  else if (ageDays > 2) level = "warning";
  return {
    label,
    level,
    snapshotDate: snapshot.snapshotDate,
    ageDays,
    rowCount: snapshot.rowCount,
    detail:
      ageDays === null
        ? "Snapshot timestamp could not be parsed."
        : ageDays === 0
          ? `Fresh — today's snapshot has ${snapshot.rowCount} rows.`
          : `Snapshot is ${ageDays} day(s) old with ${snapshot.rowCount} rows.`,
  };
}

export function summariseLevels(items: ReadinessItem[]): ReadinessLevel {
  if (items.some((item) => item.level === "missing")) return "missing";
  if (items.some((item) => item.level === "warning")) return "warning";
  return "ready";
}
