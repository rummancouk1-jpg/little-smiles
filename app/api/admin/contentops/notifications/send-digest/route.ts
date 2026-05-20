// Operator-triggered manual digest send. Used by the settings page's
// "Send a test digest" action. Same composition + send path as the
// daily cron but admin-auth gated and never blocked by the
// skip_empty_digests preference (the operator explicitly asked).

import { NextResponse } from "next/server";

import { isAuthorizedAdminRequest } from "@/lib/admin-auth";
import { logAdminAudit } from "@/lib/admin-audit";
import { emailNotificationChannel } from "@/lib/contentops/notifications/channels/email";
import { composeDailyDigest } from "@/lib/contentops/notifications/compose-digest";
import { getNotificationPreferences } from "@/lib/contentops/notifications/preferences";
import { listDrafts, type Draft } from "@/lib/contentops/drafts-store";
import { listTopics, type Topic } from "@/lib/contentops/topics-store";
import { captureServerError } from "@/lib/error-observability";

export const maxDuration = 30;

export async function POST(request: Request) {
  if (!isAuthorizedAdminRequest(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let preferences;
  try {
    preferences = await getNotificationPreferences();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to read preferences";
    captureServerError(
      "api_admin_contentops_send_digest_prefs_failed",
      err instanceof Error ? err : new Error(message),
    );
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }

  if (!preferences.digestRecipientEmail) {
    return NextResponse.json(
      {
        ok: false,
        error: "Set a recipient email before sending a test digest.",
      },
      { status: 400 },
    );
  }

  if (!emailNotificationChannel.isConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Email channel is not configured. Set RESEND_API_KEY and a sender address.",
      },
      { status: 500 },
    );
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

  const send = await emailNotificationChannel.sendDigest({
    digest,
    recipient: preferences.digestRecipientEmail,
  });

  if (!send.ok) {
    captureServerError(
      "api_admin_contentops_send_digest_failed",
      new Error(send.error),
      { recipient: preferences.digestRecipientEmail },
    );
    return NextResponse.json({ ok: false, error: send.error }, { status: 500 });
  }

  await logAdminAudit(request, {
    action: "contentops_digest_sent_manual",
    targetType: "contentops_notification_preferences",
    targetId: preferences.id,
    metadata: {
      recipient: preferences.digestRecipientEmail,
      itemCount: digest.itemCount,
      emptyState: digest.emptyState,
      messageId: send.messageId,
    },
  });

  return NextResponse.json({
    ok: true,
    messageId: send.messageId,
    itemCount: digest.itemCount,
    emptyState: digest.emptyState,
  });
}
