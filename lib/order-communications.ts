export const orderCommunicationEventTypes = [
  "order_confirmed",
  "order_dispatched",
  "order_delivered",
  "order_cancelled",
] as const;

export const orderCommunicationChannels = ["whatsapp", "sms"] as const;

export type OrderCommunicationEventType = (typeof orderCommunicationEventTypes)[number];
export type OrderCommunicationChannel = (typeof orderCommunicationChannels)[number];

export type DeliveryOutcome = {
  deliveryStatus: "sent" | "failed";
  providerResponse: Record<string, unknown> | null;
};

export function computeNextRetryAtIso(retryCount: number): string {
  const backoffMinutes = Math.min(60, 5 * Math.max(1, retryCount));
  return new Date(Date.now() + backoffMinutes * 60 * 1000).toISOString();
}

export function extractProviderError(providerResponse: Record<string, unknown> | null): string | null {
  if (!providerResponse) return null;
  const error = providerResponse.error;
  if (typeof error === "string" && error.length > 0) return error;
  const body = providerResponse.body;
  if (typeof body === "string" && body.length > 0) return body.slice(0, 200);
  const status = providerResponse.status;
  if (typeof status === "number") return `Provider status ${status}`;
  return null;
}

export function normalizePhone(phone: string | null): string | null {
  if (!phone) return null;
  const normalized = phone.replace(/\s+/g, "").trim();
  return normalized.length > 0 ? normalized : null;
}

function toE164ForPk(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  if (digits.startsWith("0")) return `+92${digits.slice(1)}`;
  return `+${digits}`;
}

export function buildTemplateMessage(
  eventType: OrderCommunicationEventType,
  order: { id: string; product_name: string; courier: string | null; tracking_id: string | null },
): string {
  const shortId = order.id.slice(0, 8);
  switch (eventType) {
    case "order_confirmed":
      return `Little Smiles update: your order #${shortId} for ${order.product_name} is confirmed. We will dispatch it soon and share tracking once ready.`;
    case "order_dispatched":
      return `Little Smiles update: your order #${shortId} has been dispatched.${
        order.courier ? ` Courier: ${order.courier}.` : ""
      }${order.tracking_id ? ` Tracking ID: ${order.tracking_id}.` : ""}`;
    case "order_delivered":
      return `Little Smiles update: your order #${shortId} is marked delivered. Thank you for shopping with us.`;
    case "order_cancelled":
      return `Little Smiles update: your order #${shortId} has been cancelled. Please message us on WhatsApp for support or re-order assistance.`;
    default:
      return `Little Smiles update for order #${shortId}.`;
  }
}

async function sendViaWebhook(payload: {
  webhookUrl: string;
  orderId: string;
  eventType: OrderCommunicationEventType;
  channel: OrderCommunicationChannel;
  phone: string | null;
  message: string;
}): Promise<DeliveryOutcome> {
  try {
    const webhookResponse = await fetch(payload.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: payload.orderId,
        eventType: payload.eventType,
        channel: payload.channel,
        phone: payload.phone,
        message: payload.message,
      }),
    });
    if (!webhookResponse.ok) {
      return {
        deliveryStatus: "failed",
        providerResponse: { provider: "webhook", ok: false, status: webhookResponse.status },
      };
    }
    return {
      deliveryStatus: "sent",
      providerResponse: { provider: "webhook", ok: true, status: webhookResponse.status },
    };
  } catch {
    return {
      deliveryStatus: "failed",
      providerResponse: { provider: "webhook", ok: false, error: "Network failure" },
    };
  }
}

async function sendViaTwilio(payload: {
  channel: OrderCommunicationChannel;
  phone: string | null;
  message: string;
}): Promise<DeliveryOutcome> {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  const smsFrom = process.env.TWILIO_SMS_FROM?.trim();
  const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM?.trim();

  if (!sid || !token) {
    return {
      deliveryStatus: "failed",
      providerResponse: { provider: "twilio", error: "Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN" },
    };
  }
  if (!payload.phone) {
    return {
      deliveryStatus: "failed",
      providerResponse: { provider: "twilio", error: "Missing recipient phone number" },
    };
  }

  const e164To = toE164ForPk(payload.phone);
  const from = payload.channel === "sms" ? smsFrom : whatsappFrom;
  if (!from) {
    return {
      deliveryStatus: "failed",
      providerResponse: {
        provider: "twilio",
        error: payload.channel === "sms" ? "Missing TWILIO_SMS_FROM" : "Missing TWILIO_WHATSAPP_FROM",
      },
    };
  }

  const body = new URLSearchParams();
  body.set("To", payload.channel === "whatsapp" ? `whatsapp:${e164To}` : e164To);
  body.set("From", payload.channel === "whatsapp" ? `whatsapp:${from}` : from);
  body.set("Body", payload.message);

  try {
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });
    if (!response.ok) {
      const text = await response.text();
      return {
        deliveryStatus: "failed",
        providerResponse: { provider: "twilio", ok: false, status: response.status, body: text.slice(0, 400) },
      };
    }
    const result = (await response.json().catch(() => null)) as { sid?: string; status?: string } | null;
    return {
      deliveryStatus: "sent",
      providerResponse: {
        provider: "twilio",
        ok: true,
        messageSid: result?.sid ?? null,
        messageStatus: result?.status ?? null,
      },
    };
  } catch {
    return {
      deliveryStatus: "failed",
      providerResponse: { provider: "twilio", ok: false, error: "Network failure" },
    };
  }
}

export async function sendWithConfiguredProvider(payload: {
  orderId: string;
  eventType: OrderCommunicationEventType;
  channel: OrderCommunicationChannel;
  phone: string | null;
  message: string;
}): Promise<DeliveryOutcome> {
  const configuredProvider = process.env.ORDER_NOTIFICATION_PROVIDER?.trim().toLowerCase();
  const webhookUrl = process.env.ORDER_NOTIFICATION_WEBHOOK_URL?.trim();

  if (configuredProvider === "twilio") {
    return sendViaTwilio({
      channel: payload.channel,
      phone: payload.phone,
      message: payload.message,
    });
  }

  if (webhookUrl) {
    return sendViaWebhook({
      webhookUrl,
      orderId: payload.orderId,
      eventType: payload.eventType,
      channel: payload.channel,
      phone: payload.phone,
      message: payload.message,
    });
  }

  return {
    deliveryStatus: "sent",
    providerResponse: { provider: "simulated", simulated: true },
  };
}
