// Cron sweep that promotes due scheduled drafts to published.
//
// Runs on the schedule defined in vercel.json. For each row whose
// scheduled_at has passed:
//   1. Call markDraftPublished (broadened source-state in Commit M allows
//      scheduled -> published).
//   2. Revalidate /blog, /blog/<slug>, /.
//   3. Continue regardless of per-row failures so one bad row never
//      blocks the rest of the sweep.
//
// Auth via CRON_SECRET Bearer token, same pattern as
// communications-retries. The sweep is idempotent — markDraftPublished's
// SQL-level guard means a row that has moved past 'scheduled' won't
// re-publish.

import { timingSafeEqual } from "node:crypto";

import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import {
  listScheduledDue,
  markDraftPublished,
} from "@/lib/contentops/drafts-store";
import { notifyDraftPublished } from "@/lib/contentops/topics-store";
import { captureServerError } from "@/lib/error-observability";

function isAuthorizedCronRequest(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) return false;
  const authHeader = request.headers.get("authorization")?.trim();
  if (!authHeader) return false;
  const expected = `Bearer ${cronSecret}`;
  const a = Buffer.from(authHeader, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

type SweepRowResult = {
  draftId: string;
  slug: string;
  status: "published" | "failed";
  error?: string;
};

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized cron request" },
      { status: 401 },
    );
  }

  const startedAt = new Date().toISOString();
  const results: SweepRowResult[] = [];

  let due;
  try {
    due = await listScheduledDue(startedAt);
  } catch (error) {
    captureServerError("api_cron_contentops_publish_due_list_failed", error);
    return NextResponse.json(
      { ok: false, error: "Failed to list due drafts" },
      { status: 500 },
    );
  }

  for (const draft of due) {
    try {
      const published = await markDraftPublished(draft.id);
      try {
        revalidatePath("/blog");
        revalidatePath(`/blog/${published.slug}`);
        revalidatePath("/");
      } catch (revalidateErr) {
        // Revalidation failure does not fail the row — ISR will catch up.
        captureServerError(
          "api_cron_contentops_publish_due_revalidate_failed",
          revalidateErr instanceof Error
            ? revalidateErr
            : new Error(String(revalidateErr)),
          { draftId: draft.id, slug: published.slug },
        );
      }
      // Best-effort topic sync so the editorial queue reflects what
      // the cron just promoted. Same isolation as the publish route:
      // failure is logged, the row stays "published" anyway.
      try {
        await notifyDraftPublished(published.id);
      } catch (topicErr) {
        captureServerError(
          "api_cron_contentops_publish_due_topic_sync_failed",
          topicErr instanceof Error
            ? topicErr
            : new Error(String(topicErr)),
          { draftId: draft.id, slug: published.slug },
        );
      }
      results.push({ draftId: draft.id, slug: draft.slug, status: "published" });
    } catch (rowErr) {
      const message = rowErr instanceof Error ? rowErr.message : String(rowErr);
      captureServerError(
        "api_cron_contentops_publish_due_row_failed",
        rowErr instanceof Error ? rowErr : new Error(message),
        { draftId: draft.id, slug: draft.slug },
      );
      results.push({
        draftId: draft.id,
        slug: draft.slug,
        status: "failed",
        error: message,
      });
    }
  }

  const succeeded = results.filter((r) => r.status === "published").length;
  const failed = results.filter((r) => r.status === "failed").length;

  return NextResponse.json({
    ok: true,
    sweptAt: startedAt,
    processed: results.length,
    succeeded,
    failed,
    results,
  });
}
