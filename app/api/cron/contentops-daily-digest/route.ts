// Daily editorial digest cron. Composes the current editorial state
// into a Digest and sends it via the email channel — once per day,
// quietly skipping when the operator has disabled the digest, hasn't
// set a recipient, or has opted into "skip empty digests" on a
// genuinely empty day.
//
// Auth: CRON_SECRET Bearer token, same pattern as the other cron
// routes. Schedule: vercel.json declares 30 3 * * * UTC (08:30 PKT) —
// morning briefing time. Vercel Hobby tier limits cron count; see
// RUNBOOK for tier considerations.

import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { emailNotificationChannel } from "@/lib/contentops/notifications/channels/email";
import { composeDailyDigest } from "@/lib/contentops/notifications/compose-digest";
import { getNotificationPreferences } from "@/lib/contentops/notifications/preferences";
import { listDrafts, type Draft } from "@/lib/contentops/drafts-store";
import { listTopics, type Topic } from "@/lib/contentops/topics-store";
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

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized cron request" },
      { status: 401 },
    );
  }

  let preferences;
  try {
    preferences = await getNotificationPreferences();
  } catch (err) {
    captureServerError(
      "api_cron_contentops_daily_digest_prefs_failed",
      err instanceof Error ? err : new Error(String(err)),
    );
    return NextResponse.json(
      { ok: false, error: "Failed to read notification preferences" },
      { status: 500 },
    );
  }

  // Quiet skips — none of these are errors, the cron just exits.
  if (!preferences.digestEnabled) {
    return NextResponse.json({ ok: true, skipped: "digest_disabled" });
  }
  if (!preferences.digestRecipientEmail) {
    return NextResponse.json({ ok: true, skipped: "no_recipient" });
  }
  if (!emailNotificationChannel.isConfigured()) {
    return NextResponse.json({ ok: true, skipped: "email_channel_not_configured" });
  }

  const [pendingDrafts, approvedDrafts, scheduledDrafts, publishedDrafts, queuedTopics] =
    (await Promise.all([
      listDrafts("pending_review").catch(() => [] as Draft[]),
      listDrafts("approved").catch(() => [] as Draft[]),
      listDrafts("scheduled").catch(() => [] as Draft[]),
      listDrafts("published").catch(() => [] as Draft[]),
      listTopics("queued").catch(() => [] as Topic[]),
    ])) as [Draft[], Draft[], Draft[], Draft[], Topic[]];

  const digest = composeDailyDigest({
    pendingDrafts,
    approvedDrafts,
    scheduledDrafts,
    publishedDrafts,
    queuedTopics,
  });

  // Respect skip-empty preference. Empty-state means no actionable items
  // AND nothing recently shipped — calm days don't deserve daily noise.
  if (preferences.skipEmptyDigests && digest.emptyState) {
    return NextResponse.json({ ok: true, skipped: "empty_state" });
  }

  const send = await emailNotificationChannel.sendDigest({
    digest,
    recipient: preferences.digestRecipientEmail,
  });

  if (!send.ok) {
    captureServerError(
      "api_cron_contentops_daily_digest_send_failed",
      new Error(send.error),
      { recipient: preferences.digestRecipientEmail },
    );
    return NextResponse.json(
      { ok: false, error: send.error },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    sent: true,
    messageId: send.messageId,
    itemCount: digest.itemCount,
    emptyState: digest.emptyState,
  });
}
