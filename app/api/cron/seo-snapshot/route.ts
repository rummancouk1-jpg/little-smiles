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
      windowStart: summary.windowStart,
      windowEnd: summary.windowEnd,
      gsc: summary.gsc,
      ga4: summary.ga4,
    },
  }).catch(() => {});

  // 200 if at least one leg succeeded; 207 multi-status for partial;
  // 502 if both legs failed (not skipped); 200+skipped if both not connected.
  const httpStatus = (() => {
    if (summary.status === "ok") return 200;
    if (summary.status === "partial") return 207;
    if (summary.status === "skipped") return 200;
    return 502;
  })();

  return NextResponse.json({ ok: summary.status !== "failed", ...summary }, { status: httpStatus });
}
