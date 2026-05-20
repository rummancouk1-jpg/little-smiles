import { NextResponse } from "next/server";
import { Resend } from "resend";

import { logSystemAudit } from "@/lib/admin-audit";
import { buildDigestPlan, renderDigestEmail, type DigestPlan } from "@/lib/contentops/digest";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { captureServerError } from "@/lib/error-observability";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

type DigestRecipients = {
  to: string[];
  from: string;
};

function resolveRecipients(): DigestRecipients | null {
  const explicitTo = process.env.CONTENTOPS_DIGEST_TO?.trim();
  const fallbackTo = process.env.CONTACT_TO_EMAIL?.trim();
  const from = process.env.CONTACT_FROM_EMAIL?.trim();
  const toRaw = explicitTo || fallbackTo;
  if (!toRaw || !from) return null;

  const to = toRaw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (to.length === 0) return null;
  return { to, from };
}

type SendOutcome =
  | { sent: true; messageId?: string }
  | { sent: false; reason: string };

async function deliverDigest(plan: DigestPlan, recipients: DigestRecipients): Promise<SendOutcome> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return { sent: false, reason: "RESEND_API_KEY missing" };

  const email = renderDigestEmail(plan, { baseUrl: siteUrl });

  try {
    const resend = new Resend(key);
    const { data, error } = await resend.emails.send({
      from: recipients.from,
      to: recipients.to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
    if (error) {
      return { sent: false, reason: error.message || "Resend error" };
    }
    return { sent: true, messageId: data?.id };
  } catch (err) {
    return { sent: false, reason: err instanceof Error ? err.message : "Resend exception" };
  }
}

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized cron request" }, { status: 401 });
  }

  let plan: DigestPlan;
  try {
    plan = await buildDigestPlan();
  } catch (error) {
    captureServerError("api_cron_contentops_digest_load_failed", error);
    await logSystemAudit({
      action: "contentops_digest_run",
      metadata: { status: "error", reason: "load_failed" },
    }).catch(() => {});
    return NextResponse.json({ ok: false, error: "Failed to load drafts" }, { status: 500 });
  }

  if (!plan.shouldSend) {
    await logSystemAudit({
      action: "contentops_digest_run",
      metadata: { status: "skipped", reason: plan.skippedReason ?? "empty_queue", pendingCount: 0 },
    }).catch(() => {});
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: plan.skippedReason,
      pendingCount: 0,
    });
  }

  const recipients = resolveRecipients();
  if (!recipients) {
    await logSystemAudit({
      action: "contentops_digest_run",
      metadata: {
        status: "error",
        reason: "recipients_unconfigured",
        pendingCount: plan.pendingCount,
      },
    }).catch(() => {});
    return NextResponse.json(
      {
        ok: false,
        error:
          "Digest recipients not configured. Set CONTENTOPS_DIGEST_TO (or CONTACT_TO_EMAIL) and CONTACT_FROM_EMAIL.",
        pendingCount: plan.pendingCount,
      },
      { status: 503 },
    );
  }

  const outcome = await deliverDigest(plan, recipients);
  await logSystemAudit({
    action: "contentops_digest_run",
    metadata: {
      status: outcome.sent ? "sent" : "failed",
      pendingCount: plan.pendingCount,
      recipientCount: recipients.to.length,
      reason: outcome.sent ? null : outcome.reason,
    },
  }).catch(() => {});

  if (!outcome.sent) {
    captureServerError(
      "api_cron_contentops_digest_send_failed",
      new Error(outcome.reason),
      { pendingCount: plan.pendingCount },
    );
    return NextResponse.json(
      { ok: false, error: outcome.reason, pendingCount: plan.pendingCount },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    pendingCount: plan.pendingCount,
    recipientCount: recipients.to.length,
    messageId: outcome.messageId,
  });
}
