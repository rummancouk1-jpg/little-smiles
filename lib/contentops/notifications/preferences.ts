// Notification preferences storage. Singleton row, addressed by
// id='default'. Engine-level — no auth, no UI knowledge.

import type { NotificationPreferences } from "@/lib/contentops/notifications/types";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const SINGLETON_ID = "default";

function requireClient() {
  const client = getSupabaseAdminClient();
  if (!client) {
    throw new Error("Supabase admin client is not configured.");
  }
  return client;
}

type RowShape = {
  id: string;
  digest_enabled: boolean;
  digest_recipient_email: string | null;
  skip_empty_digests: boolean;
  updated_at: string;
};

function fromRow(row: RowShape): NotificationPreferences {
  return {
    id: "default",
    digestEnabled: row.digest_enabled,
    digestRecipientEmail: row.digest_recipient_email,
    skipEmptyDigests: row.skip_empty_digests,
    updatedAt: row.updated_at,
  };
}

// Fetch the singleton. The schema seeds a row on migration, so this
// should normally never return null — but if it does (e.g., the row
// was manually deleted), the engine inserts defaults and returns them.
export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const supabase = requireClient();

  const { data, error } = await supabase
    .from("contentops_notification_preferences")
    .select("*")
    .eq("id", SINGLETON_ID)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to read notification preferences: ${error.message}`);
  }
  if (data) return fromRow(data as RowShape);

  // Defensive: re-seed the singleton if it's missing for any reason.
  const { data: inserted, error: insertErr } = await supabase
    .from("contentops_notification_preferences")
    .insert({
      id: SINGLETON_ID,
      digest_enabled: false,
      digest_recipient_email: null,
      skip_empty_digests: true,
    })
    .select("*")
    .single();
  if (insertErr || !inserted) {
    throw new Error(
      `Failed to seed notification preferences: ${insertErr?.message ?? "no row returned"}`,
    );
  }
  return fromRow(inserted as RowShape);
}

type UpdateInput = {
  digestEnabled?: boolean;
  digestRecipientEmail?: string | null;
  skipEmptyDigests?: boolean;
};

type UpdatePayload = {
  digest_enabled?: boolean;
  digest_recipient_email?: string | null;
  skip_empty_digests?: boolean;
  updated_at?: string;
};

export async function updateNotificationPreferences(
  input: UpdateInput,
): Promise<NotificationPreferences> {
  const supabase = requireClient();
  const updates: UpdatePayload = {
    updated_at: new Date().toISOString(),
  };
  if (input.digestEnabled !== undefined) {
    updates.digest_enabled = input.digestEnabled;
  }
  if (input.digestRecipientEmail !== undefined) {
    const trimmed = input.digestRecipientEmail?.trim();
    updates.digest_recipient_email = trimmed && trimmed.length > 0 ? trimmed : null;
  }
  if (input.skipEmptyDigests !== undefined) {
    updates.skip_empty_digests = input.skipEmptyDigests;
  }

  const { data, error } = await supabase
    .from("contentops_notification_preferences")
    .update(updates)
    .eq("id", SINGLETON_ID)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `Failed to update notification preferences: ${error?.message ?? "no row returned"}`,
    );
  }
  return fromRow(data as RowShape);
}
