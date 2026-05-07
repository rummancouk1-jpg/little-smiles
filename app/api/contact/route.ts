import { NextResponse } from "next/server";
import { z } from "zod";

const contactSchema = z
  .object({
    name: z.string().min(2).max(120),
    phone: z.string().min(10).max(40),
    message: z.string().min(10).max(8000),
    /** Honeypot — must be empty (bots often fill hidden fields). */
    website: z.string().optional(),
  })
  .refine((d) => d.website == null || d.website.length === 0, {
    path: ["website"],
    message: "Invalid submission.",
  });

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function sendResendEmail(input: {
  to: string;
  from: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return false;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: input.from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
    }),
    signal: AbortSignal.timeout(12_000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.warn("[contact] Resend error", res.status, errText);
  }
  return res.ok;
}

async function notifyWebhook(url: string, body: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8_000),
    });
    return res.ok;
  } catch (e) {
    console.warn("[contact] webhook failed", e);
    return false;
  }
}

/**
 * Contact form delivery (configure at least one in production for real delivery):
 * - `RESEND_API_KEY` + `CONTACT_EMAIL_FROM` + `CONTACT_EMAIL_TO`
 * - `CONTACT_NOTIFY_WEBHOOK_URL` (Slack / Discord / Zapier / Make)
 *
 * If neither is configured, submissions are logged to the server console only (dev-friendly).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = contactSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid request body." },
        { status: 400 },
      );
    }

    const { name, phone, message } = parsed.data;
    const receivedAt = new Date().toISOString();

    const summary = {
      kind: "contact_form" as const,
      receivedAt,
      name,
      phone,
      messagePreview: message.slice(0, 280),
    };

    console.info("[contact]", JSON.stringify(summary));

    const webhookUrl = process.env.CONTACT_NOTIFY_WEBHOOK_URL?.trim();
    let delivered = false;

    if (webhookUrl) {
      delivered = await notifyWebhook(webhookUrl, {
        ...summary,
        message,
      });
    }

    const to = process.env.CONTACT_EMAIL_TO?.trim();
    const from = process.env.CONTACT_EMAIL_FROM?.trim();
    const resendKey = process.env.RESEND_API_KEY?.trim();

    if (resendKey && to && from) {
      const html = `
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Phone:</strong> ${escapeHtml(phone)}</p>
        <p><strong>Message:</strong></p>
        <p>${escapeHtml(message).replaceAll("\n", "<br/>")}</p>
        <hr/>
        <p style="color:#666;font-size:12px">Received ${escapeHtml(receivedAt)} — Little Smiles site</p>
      `;
      const ok = await sendResendEmail({
        from,
        to,
        subject: `Little Smiles contact: ${name.slice(0, 60)}`,
        html,
      });
      delivered = delivered || ok;
    }

    const isProd = process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
    if (isProd && !delivered && !webhookUrl && !(resendKey && to && from)) {
      console.warn(
        "[contact] No delivery channel configured — set RESEND_* or CONTACT_NOTIFY_WEBHOOK_URL",
      );
    }

    return NextResponse.json({ ok: true, delivered });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Could not process request." },
      { status: 500 },
    );
  }
}
