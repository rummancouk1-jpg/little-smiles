import { Resend } from "resend";

/**
 * Shared transactional-email path (Resend). Used by the contact form and the
 * COD order notification so both send through one provider integration.
 *
 * Returns `false` (never throws) when the API key is missing or the send fails,
 * so callers can treat email as best-effort and never let it break a request.
 */
export async function sendResendEmail(input: {
  to: string;
  from: string;
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<boolean> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return false;

  try {
    const resend = new Resend(key);
    const { error } = await resend.emails.send({
      from: input.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      ...(input.replyTo ? { replyTo: input.replyTo } : {}),
    });

    if (error) {
      console.warn("[email] Resend error", error);
      return false;
    }
    return true;
  } catch (e) {
    console.warn("[email] Resend failed", e);
    return false;
  }
}

export function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
