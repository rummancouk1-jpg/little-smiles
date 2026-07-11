import "server-only";

import { after } from "next/server";

import { escapeHtml, sendResendEmail } from "@/lib/email";
import { captureServerError } from "@/lib/error-observability";
import { formatPkr } from "@/lib/products";

export type CodOrderNotification = {
  customer: {
    fullName: string;
    phone: string;
    city: string;
    address: string;
    note?: string;
  };
  items: { slug: string; name: string; quantity: number; pricePkr: number }[];
  quantity: number;
  totalPkr: number;
  sourcePage: string;
  timestamp: string;
};

function buildOrderEmailHtml(order: CodOrderNotification): string {
  const rows = order.items
    .map(
      (item) => `
        <tr>
          <td style="padding:8px 10px;border-bottom:1px solid #efe6de">${escapeHtml(item.name)}<br/><span style="font-size:12px;color:#8a7c78">${escapeHtml(item.slug)}</span></td>
          <td style="padding:8px 10px;border-bottom:1px solid #efe6de;text-align:center">${item.quantity}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #efe6de;text-align:right">${escapeHtml(formatPkr(item.pricePkr))}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #efe6de;text-align:right">${escapeHtml(formatPkr(item.pricePkr * item.quantity))}</td>
        </tr>`,
    )
    .join("");

  return `
    <div style="font-family:Arial,sans-serif;background:#f8f4ef;padding:24px;color:#231b1a;line-height:1.6">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #efe6de;border-radius:14px;overflow:hidden">
        <div style="padding:18px 22px;background:#fbf4ee;border-bottom:1px solid #f0e7df">
          <h2 style="margin:0;font-size:18px;color:#1f1918">New COD Order — action needed</h2>
          <p style="margin:6px 0 0;font-size:13px;color:#4a3f3d">Confirm stock, delivery fee &amp; final total on WhatsApp</p>
        </div>
        <div style="padding:18px 22px">
          <h3 style="margin:0 0 8px;font-size:14px;color:#1f1918">Customer</h3>
          <p style="margin:0 0 6px"><strong>Name:</strong> ${escapeHtml(order.customer.fullName)}</p>
          <p style="margin:0 0 6px"><strong>Phone (WhatsApp):</strong> ${escapeHtml(order.customer.phone)}</p>
          <p style="margin:0 0 6px"><strong>City:</strong> ${escapeHtml(order.customer.city)}</p>
          <p style="margin:0 0 6px"><strong>Address:</strong> ${escapeHtml(order.customer.address)}</p>
          ${order.customer.note ? `<p style="margin:0 0 6px"><strong>Note:</strong> ${escapeHtml(order.customer.note)}</p>` : ""}

          <h3 style="margin:16px 0 8px;font-size:14px;color:#1f1918">Order</h3>
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead>
              <tr style="text-align:left;color:#655754">
                <th style="padding:8px 10px;border-bottom:2px solid #efe6de">Item</th>
                <th style="padding:8px 10px;border-bottom:2px solid #efe6de;text-align:center">Qty</th>
                <th style="padding:8px 10px;border-bottom:2px solid #efe6de;text-align:right">Unit</th>
                <th style="padding:8px 10px;border-bottom:2px solid #efe6de;text-align:right">Line</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <p style="margin:12px 0 0;text-align:right;font-size:15px"><strong>Subtotal (${order.quantity} item${order.quantity === 1 ? "" : "s"}):</strong> ${escapeHtml(formatPkr(order.totalPkr))}</p>
          <p style="margin:4px 0 0;text-align:right;font-size:12px;color:#655754">Payment: Cash on Delivery · Delivery fee added after city/address confirmation</p>

          <p style="margin:16px 0 0;font-size:12px;color:#655754"><strong>Source:</strong> ${escapeHtml(order.sourcePage)}</p>
          <p style="margin:4px 0 0;font-size:12px;color:#655754"><strong>Captured:</strong> ${escapeHtml(order.timestamp)}</p>
        </div>
      </div>
    </div>`;
}

/**
 * Schedule a best-effort order-notification email to the store owner AFTER the
 * response is sent (`after`), so it never blocks or fails the customer's
 * checkout. The order is already persisted by the time this runs; a delivery
 * failure is logged to Sentry and costs nothing but the email.
 */
export function scheduleCodOrderNotification(order: CodOrderNotification): void {
  const to = process.env.CONTACT_TO_EMAIL?.trim();
  const from = process.env.CONTACT_FROM_EMAIL?.trim();
  const key = process.env.RESEND_API_KEY?.trim();

  if (!to || !from || !key) {
    console.warn(
      "[order-notify] email not configured — set RESEND_API_KEY, CONTACT_TO_EMAIL, CONTACT_FROM_EMAIL",
    );
    return;
  }

  after(async () => {
    try {
      const delivered = await sendResendEmail({
        to,
        from,
        replyTo: from,
        subject: `New COD order — ${order.customer.fullName} (${order.customer.city}) · ${formatPkr(order.totalPkr)}`,
        html: buildOrderEmailHtml(order),
      });
      if (!delivered) {
        console.warn("[order-notify] email delivery unavailable for captured order");
      }
    } catch (error) {
      captureServerError("order_notify_email_failed", error);
    }
  });
}
