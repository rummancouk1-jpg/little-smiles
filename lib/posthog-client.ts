"use client";

import type { PostHog } from "posthog-js";

let clientPromise: Promise<PostHog | null> | null = null;

function posthogApiKey(): string | undefined {
  const raw = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  return typeof raw === "string" && raw.trim() !== "" ? raw.trim() : undefined;
}

/**
 * Lazily loads `posthog-js` (dynamic import) and initializes once.
 * Keeps analytics off the critical path for LCP / main-thread work.
 */
export function getPostHogClient(): Promise<PostHog | null> {
  if (typeof window === "undefined") return Promise.resolve(null);

  const key = posthogApiKey();
  if (!key) return Promise.resolve(null);

  if (!clientPromise) {
    clientPromise = import("posthog-js").then(({ default: posthog }) => {
      posthog.init(key, {
        api_host:
          process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com",
        capture_pageview: false,
        autocapture: true,
      });
      return posthog;
    });
  }

  return clientPromise;
}

/** Fire-and-forget event; works from click handlers (loads SDK on first use if not yet idle). */
export function capturePostHogEvent(
  event: string,
  properties?: Record<string, unknown>,
): void {
  if (
    event === "whatsapp_order_clicked" &&
    typeof window !== "undefined" &&
    typeof fetch === "function"
  ) {
    const body = JSON.stringify({
      source: properties?.source,
      product_slug: properties?.product_slug,
      quantity: properties?.quantity,
      has_variant_note: properties?.has_variant_note,
      has_size_note: properties?.has_size_note,
    });
    void fetch("/api/events/whatsapp-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  }

  void getPostHogClient().then((client) => {
    if (!client) return;
    client.capture(event, properties);
  });
}

/**
 * Defer work until the browser is idle (with timeout) so the main thread can paint first.
 */
export function runWhenIdle(fn: () => void): void {
  if (typeof window === "undefined") return;
  const ric = window.requestIdleCallback;
  if (typeof ric === "function") {
    ric(() => fn(), { timeout: 4_000 });
  } else {
    window.setTimeout(fn, 1);
  }
}
