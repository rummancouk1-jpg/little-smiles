import { NextResponse } from "next/server";

import { logSystemAudit } from "@/lib/admin-audit";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { captureServerError } from "@/lib/error-observability";
import { runSnapshotPipeline } from "@/lib/seo-intelligence/snapshot-pipeline";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized cron request" }, { status: 401 });
  }

  if (!getSupabaseAdminClient()) {
    return NextResponse.json(
      { ok: false, error: "Supabase not configured — snapshot pipeline requires persistence." },
      { status: 503 },
    );
  }

  let summary;
  try {
    summary = await runSnapshotPipeline();
  } catch (err) {
    captureServerError("api_cron_seo_snapshot_failed", err);
    await logSystemAudit({
      action: "seo_snapshot_run",
      metadata: { status: "error", reason: err instanceof Error ? err.message : "Unknown pipeline error" },
    }).catch(() => {});
    return NextResponse.json({ ok: false, error: "Snapshot pipeline crashed" }, { status: 500 });
  }

  await logSystemAudit({
    action: "seo_snapshot_run",
    metadata: {
      status: summary.status,
      warnings: summary.warnings,
      windowStart: summary.windowStart,
      windowEnd: summary.windowEnd,
      gsc: summary.gsc,
      ga4: summary.ga4,
    },
  }).catch(() => {});

  return NextResponse.json({ ok: true, ...summary }, { status: 200 });
}
