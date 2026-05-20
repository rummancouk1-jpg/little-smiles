// Orphan storage cleanup. Two endpoints on the same route:
//   GET   — read-only report of orphan storage keys.
//   POST  — sweep the orphans (idempotent; operator-triggered).
//
// Bulk deletes are bounded by a generous cap so a runaway sweep can't
// take down the bucket. The list path also returns total counts +
// recoverable bytes so the operator UI can show what they're about to
// delete before they commit.

import { NextResponse } from "next/server";
import { z } from "zod";

import { isAuthorizedAdminRequest } from "@/lib/admin-auth";
import { logAdminAudit } from "@/lib/admin-audit";
import { listDrafts } from "@/lib/contentops/drafts-store";
import { computeOrphanReport } from "@/lib/contentops/intelligence/storage-orphans";
import {
  bulkDeleteStorageKeys,
  listAllBucketObjects,
} from "@/lib/contentops/storage";
import { captureServerError } from "@/lib/error-observability";

export const maxDuration = 60;

const MAX_DELETE_PER_REQUEST = 200;

async function buildReport() {
  const [entries, allDrafts] = await Promise.all([
    listAllBucketObjects(),
    Promise.all(
      (
        [
          "pending_review",
          "approved",
          "rejected",
          "published",
          "scheduled",
        ] as const
      ).map((s) => listDrafts(s).catch(() => [])),
    ).then((slices) => slices.flat()),
  ]);
  return computeOrphanReport({ drafts: allDrafts, entries });
}

export async function GET(request: Request) {
  if (!isAuthorizedAdminRequest(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const report = await buildReport();
    return NextResponse.json({ ok: true, report });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to build orphan report";
    captureServerError(
      "api_admin_contentops_storage_orphans_read_failed",
      err instanceof Error ? err : new Error(message),
    );
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

const deleteSchema = z.object({
  /**
   * Explicit confirmation. The operator UI sends `confirm: true` only
   * after they've reviewed the report. The route refuses sweeps
   * without it so a curious script can't drop the bucket.
   */
  confirm: z.literal(true),
  /** Optional cap on keys per call; defaults to MAX_DELETE_PER_REQUEST. */
  limit: z.number().int().min(1).max(MAX_DELETE_PER_REQUEST).optional(),
});

export async function POST(request: Request) {
  if (!isAuthorizedAdminRequest(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "Request must include { confirm: true }. Review the report first.",
      },
      { status: 400 },
    );
  }

  let report;
  try {
    report = await buildReport();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to build orphan report";
    captureServerError(
      "api_admin_contentops_storage_orphans_sweep_read_failed",
      err instanceof Error ? err : new Error(message),
    );
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }

  const limit = parsed.data.limit ?? MAX_DELETE_PER_REQUEST;
  const keys = report.orphans.slice(0, limit).map((o) => o.storageKey);
  if (keys.length === 0) {
    return NextResponse.json({
      ok: true,
      requested: 0,
      removed: 0,
      remainingOrphans: 0,
    });
  }

  const result = await bulkDeleteStorageKeys(keys);
  await logAdminAudit(request, {
    action: "contentops_storage_orphans_swept",
    targetType: "contentops_storage_bucket",
    targetId: "contentops-images",
    metadata: {
      requested: result.requested,
      removed: result.removed,
      totalOrphans: report.orphans.length,
      remainingOrphans: Math.max(0, report.orphans.length - result.removed),
      recoverableBytes: report.recoverableBytes,
      error: result.error ?? null,
    },
  });

  if (result.error) {
    return NextResponse.json(
      {
        ok: false,
        requested: result.requested,
        removed: result.removed,
        error: result.error,
      },
      { status: 500 },
    );
  }
  return NextResponse.json({
    ok: true,
    requested: result.requested,
    removed: result.removed,
    remainingOrphans: Math.max(0, report.orphans.length - result.removed),
    recoverableBytes: report.recoverableBytes,
  });
}
