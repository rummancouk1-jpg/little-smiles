// Notification engine types. Channel-agnostic, event-agnostic. The
// concrete payloads (Digest in compose-digest.ts) reference these types;
// future per-event sends (draft_ready, publish_confirmation, etc.) will
// add their own payload shapes that adapters can pattern-match on.
//
// Architectural intent: never bake provider-specific assumptions into
// shared types. Resend, WhatsApp, future email providers should all be
// reachable via the same NotificationChannelAdapter contract.

export type NotificationKind =
  | "daily_digest"
  | "draft_ready"
  | "review_required"
  | "scheduled_reminder"
  | "publish_confirmation"
  | "cadence_gap"
  | "low_topic_queue";

export type NotificationChannel = "email" | "whatsapp";

export type ChannelSendResult =
  | { ok: true; messageId?: string }
  | { ok: false; error: string };

// Digest is the only payload shape Commit W actually sends. Future
// per-event notifications will define their own payload shapes
// alongside it.
export type DigestItem = {
  primary: string;
  secondary?: string;
};

export type DigestSection = {
  id: string;
  heading: string;
  items: DigestItem[];
  /** Optional tail line — used for "Heads up" calm hints */
  hint?: string;
};

export type Digest = {
  kind: "daily_digest";
  generatedAt: string;
  greeting: string;
  intro?: string;
  sections: DigestSection[];
  closing: string;
  /** True when no section carries actionable items. */
  emptyState: boolean;
  /** Total actionable items across sections — useful for adapters. */
  itemCount: number;
};

/**
 * Channel adapter contract. Each concrete adapter (email, future
 * whatsapp, etc.) implements this; the cron and manual-send routes call
 * isConfigured() before attempting send so missing credentials degrade
 * to a calm skip rather than a 500.
 */
export interface NotificationChannelAdapter {
  readonly channel: NotificationChannel;
  isConfigured(): boolean;
  sendDigest(args: {
    digest: Digest;
    recipient: string;
  }): Promise<ChannelSendResult>;
}

export type NotificationPreferences = {
  id: "default";
  digestEnabled: boolean;
  digestRecipientEmail: string | null;
  skipEmptyDigests: boolean;
  updatedAt: string;
};
