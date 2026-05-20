// Email channel adapter for the notification engine. Renders Digest
// payloads to a calm editorial email (plain text + light HTML) and
// sends via Resend (already in the stack from the contact form flow).
//
// Configuration: CONTENTOPS_DIGEST_FROM_EMAIL for the sender address
// (falls back to CONTACT_FROM_EMAIL if not set, since both flow through
// the same Resend domain). RESEND_API_KEY is required.
//
// Failure mode: returns { ok: false, error: ... } for missing config or
// API errors. Never throws — the cron and manual-send routes decide
// whether to surface or quietly log.

import { Resend } from "resend";

import { parseRecipientList } from "@/lib/contentops/notifications/recipients";
import type {
  ChannelSendResult,
  Digest,
  DigestSection,
  NotificationChannelAdapter,
} from "@/lib/contentops/notifications/types";

function getResendKey(): string | null {
  const key = process.env.RESEND_API_KEY?.trim();
  return key && key.length > 0 ? key : null;
}

function getFromAddress(): string | null {
  const dedicated = process.env.CONTENTOPS_DIGEST_FROM_EMAIL?.trim();
  if (dedicated && dedicated.length > 0) return dedicated;
  const fallback = process.env.CONTACT_FROM_EMAIL?.trim();
  if (fallback && fallback.length > 0) return fallback;
  return null;
}

function renderPlaintext(digest: Digest): string {
  const lines: string[] = [];
  lines.push(digest.greeting);
  lines.push("");
  if (digest.intro) {
    lines.push(digest.intro);
    lines.push("");
  }
  for (const section of digest.sections) {
    lines.push(section.heading);
    for (const item of section.items) {
      lines.push(
        `  · ${item.primary}${item.secondary ? `  (${item.secondary})` : ""}`,
      );
    }
    if (section.hint) {
      lines.push(`  ${section.hint}`);
    }
    lines.push("");
  }
  lines.push(digest.closing);
  lines.push("");
  lines.push("— Little Smiles Editorial");
  return lines.join("\n");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderSection(section: DigestSection): string {
  const items = section.items
    .map((item) => {
      const sec = item.secondary
        ? `<span style="color:#3B2F2F99;font-size:12px;"> · ${escapeHtml(item.secondary)}</span>`
        : "";
      return `<li style="margin:6px 0;line-height:1.5;color:#1F1918;">${escapeHtml(item.primary)}${sec}</li>`;
    })
    .join("");
  return `
    <section style="margin:0 0 24px 0;">
      <h2 style="margin:0 0 8px 0;font-size:14px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#3B2F2F99;">${escapeHtml(section.heading)}</h2>
      <ul style="margin:0;padding-left:18px;list-style-type:disc;">${items}</ul>
      ${section.hint ? `<p style="margin:8px 0 0 0;font-size:12px;color:#3B2F2F99;">${escapeHtml(section.hint)}</p>` : ""}
    </section>
  `.trim();
}

function renderHtml(digest: Digest): string {
  const sections = digest.sections.map(renderSection).join("\n");
  return `
<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background-color:#FDF8F4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FDF8F4;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#ffffff;border:1px solid #3B2F2F1A;border-radius:24px;padding:32px 28px;">
            <tr>
              <td>
                <p style="margin:0 0 4px 0;font-size:11px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:#3B2F2F80;">Little Smiles Editorial</p>
                <h1 style="margin:0 0 16px 0;font-size:24px;font-weight:600;color:#1F1918;letter-spacing:-0.01em;">${escapeHtml(digest.greeting)}</h1>
                ${digest.intro ? `<p style="margin:0 0 28px 0;font-size:15px;line-height:1.6;color:#3B2F2FB8;">${escapeHtml(digest.intro)}</p>` : ""}
                ${sections}
                <hr style="border:none;border-top:1px solid #3B2F2F1A;margin:24px 0 16px 0;" />
                <p style="margin:0;font-size:13px;color:#3B2F2F99;">${escapeHtml(digest.closing)}</p>
                <p style="margin:16px 0 0 0;font-size:11px;color:#3B2F2F80;">— Little Smiles Editorial</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `.trim();
}

function subjectFor(digest: Digest): string {
  if (digest.emptyState) {
    return "Editorial digest — nothing pressing today";
  }
  return `Editorial digest — ${digest.itemCount} ${digest.itemCount === 1 ? "thing" : "things"} to look at`;
}

export const emailNotificationChannel: NotificationChannelAdapter = {
  channel: "email",
  isConfigured(): boolean {
    return getResendKey() !== null && getFromAddress() !== null;
  },
  async sendDigest({ digest, recipient }): Promise<ChannelSendResult> {
    const apiKey = getResendKey();
    if (!apiKey) {
      return { ok: false, error: "RESEND_API_KEY is not configured." };
    }
    const from = getFromAddress();
    if (!from) {
      return {
        ok: false,
        error:
          "No sender address configured. Set CONTENTOPS_DIGEST_FROM_EMAIL or CONTACT_FROM_EMAIL.",
      };
    }
    // Recipient may be a single address (legacy/backward compat) or a
    // comma-separated list. parseRecipientList collapses both to a
    // deduplicated, validated array. Single-entry lists send identically
    // to the previous single-recipient flow.
    const parsed = parseRecipientList(recipient);
    if (!parsed.ok) {
      return {
        ok: false,
        error: `Invalid recipient email${parsed.invalid.length > 1 ? "s" : ""}: ${parsed.invalid.join(", ")}`,
      };
    }
    if (parsed.emails.length === 0) {
      return { ok: false, error: "Recipient email is empty." };
    }

    const resend = new Resend(apiKey);
    const subject = subjectFor(digest);
    const html = renderHtml(digest);
    const text = renderPlaintext(digest);

    try {
      const { data, error } = await resend.emails.send({
        from,
        to: parsed.emails,
        subject,
        html,
        text,
      });
      if (error) {
        return { ok: false, error: error.message ?? String(error) };
      }
      return { ok: true, messageId: data?.id };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: message };
    }
  },
};
