import { NextResponse } from "next/server";
import { z } from "zod";

import { escapeHtml, sendResendEmail } from "@/lib/email";
import { captureServerError } from "@/lib/error-observability";
import { checkRequestRateLimit } from "@/lib/request-rate-limit";

const contactSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(200),
    phone: z.string().trim().min(7).max(40),
    message: z.string().trim().min(10).max(8000),
    pageUrl: z.string().trim().url().max(1500).optional(),
    /** Honeypot — must be empty (bots often fill hidden fields). */
    website: z.string().optional(),
  })
  .refine((d) => d.website == null || d.website.length === 0, {
    path: ["website"],
    message: "Invalid submission.",
  });

const urlLikePattern = /(https?:\/\/|www\.|\.com\b|\.pk\b|\.net\b)/i;

function isSuspiciousSubmission(input: {
  name: string;
  email: string;
  phone: string;
  message: string;
}): boolean {
  const compactMessage = input.message.replace(/\s+/g, " ").trim();
  const digitsInPhone = input.phone.replace(/\D/g, "");
  const linksInMessage = (compactMessage.match(/https?:\/\//gi) ?? []).length;

  if (digitsInPhone.length < 7 || digitsInPhone.length > 15) return true;
  if (linksInMessage > 1) return true;
  if (compactMessage.length > 0 && /^([a-z0-9])\1{12,}$/i.test(compactMessage)) return true;
  if (urlLikePattern.test(input.name)) return true;
  if (compactMessage.toLowerCase().includes("<script")) return true;

  return false;
}

export async function POST(request: Request) {
  const rate = checkRequestRateLimit({
    request,
    routeKey: "contact",
    limit: 8,
    windowMs: 10 * 60 * 1000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many submissions. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  try {
    const body = await request.json();
    const parsed = contactSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid request body." },
        { status: 400 },
      );
    }

    const { name, email, phone, message, pageUrl } = parsed.data;
    if (isSuspiciousSubmission({ name, email, phone, message })) {
      return NextResponse.json(
        { ok: false, error: "Please submit a valid message." },
        { status: 400 },
      );
    }

    const receivedAt = new Date().toISOString();
    const sourceUrl =
      pageUrl ||
      request.headers.get("origin") ||
      request.headers.get("referer") ||
      undefined;

    const summary = {
      kind: "contact_form" as const,
      receivedAt,
      name,
      email,
      phone,
      messagePreview: message.slice(0, 280),
      sourceUrl,
    };

    console.info("[contact]", JSON.stringify(summary));

    let delivered = false;
    const to = process.env.CONTACT_TO_EMAIL?.trim();
    const from = process.env.CONTACT_FROM_EMAIL?.trim();
    const resendKey = process.env.RESEND_API_KEY?.trim();

    if (resendKey && to && from) {
      const html = `
        <div style="font-family:Arial,sans-serif;background:#f8f4ef;padding:24px;color:#231b1a;line-height:1.6">
          <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #efe6de;border-radius:14px;overflow:hidden">
            <div style="padding:18px 22px;background:#fbf4ee;border-bottom:1px solid #f0e7df">
              <h2 style="margin:0;font-size:18px;color:#1f1918">New Contact Inquiry</h2>
              <p style="margin:6px 0 0;font-size:13px;color:#4a3f3d">Little Smiles website</p>
            </div>
            <div style="padding:18px 22px">
              <p style="margin:0 0 8px"><strong>Customer Name:</strong> ${escapeHtml(name)}</p>
              <p style="margin:0 0 8px"><strong>Email:</strong> ${escapeHtml(email)}</p>
              <p style="margin:0 0 8px"><strong>Phone:</strong> ${escapeHtml(phone)}</p>
              <p style="margin:16px 0 6px"><strong>Message:</strong></p>
              <div style="padding:12px;border:1px solid #efe6de;border-radius:10px;background:#fdfaf7">${escapeHtml(message).replaceAll("\n", "<br/>")}</div>
              <p style="margin:14px 0 0;font-size:12px;color:#655754"><strong>Source URL:</strong> ${sourceUrl ? escapeHtml(sourceUrl) : "N/A"}</p>
              <p style="margin:6px 0 0;font-size:12px;color:#655754"><strong>Timestamp:</strong> ${escapeHtml(receivedAt)}</p>
            </div>
          </div>
        </div>
      `;
      const ok = await sendResendEmail({
        from,
        to,
        replyTo: email,
        subject: `Little Smiles contact inquiry: ${name.slice(0, 60)}`,
        html,
      });
      delivered = ok;
    }

    if (!delivered) {
      console.warn("[contact] Email delivery unavailable. Configure RESEND_API_KEY and contact emails.");
    }

    return NextResponse.json({ ok: true, delivered });
  } catch (error) {
    captureServerError("api_contact_post_failed", error);
    return NextResponse.json(
      { ok: false, error: "Could not process request." },
      { status: 500 },
    );
  }
}
