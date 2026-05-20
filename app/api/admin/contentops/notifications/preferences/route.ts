import { NextResponse } from "next/server";
import { z } from "zod";

import { isAuthorizedAdminRequest } from "@/lib/admin-auth";
import { logAdminAudit } from "@/lib/admin-audit";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "@/lib/contentops/notifications/preferences";
import { normalizeRecipientString } from "@/lib/contentops/notifications/recipients";
import { captureServerError } from "@/lib/error-observability";

// digestRecipientEmail accepts either a single address or a comma-
// separated list. Per-address validation runs inside
// normalizeRecipientString below so we can surface the offending entries.
const putSchema = z.object({
  digestEnabled: z.boolean().optional(),
  digestRecipientEmail: z.string().max(2000).nullable().optional(),
  skipEmptyDigests: z.boolean().optional(),
});

export async function GET(request: Request) {
  if (!isAuthorizedAdminRequest(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const preferences = await getNotificationPreferences();
    return NextResponse.json({ ok: true, preferences });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to read preferences";
    captureServerError(
      "api_admin_contentops_notification_prefs_read_failed",
      err instanceof Error ? err : new Error(message),
    );
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!isAuthorizedAdminRequest(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = putSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid preferences payload" },
      { status: 400 },
    );
  }

  // Normalize the (optional) recipient string. parseRecipientList trims,
  // dedupes, and validates each address; a parse failure produces an
  // operator-readable error string we can surface directly.
  let normalizedRecipient: string | null | undefined;
  if (parsed.data.digestRecipientEmail !== undefined) {
    try {
      normalizedRecipient = normalizeRecipientString(parsed.data.digestRecipientEmail);
    } catch (err) {
      return NextResponse.json(
        { ok: false, error: err instanceof Error ? err.message : "Invalid recipient email" },
        { status: 400 },
      );
    }
  }

  // Gate: digest_enabled=true requires at least one recipient.
  if (parsed.data.digestEnabled === true) {
    const incomingHasRecipient =
      normalizedRecipient !== undefined && normalizedRecipient !== null;
    if (!incomingHasRecipient) {
      try {
        const current = await getNotificationPreferences();
        if (!current.digestRecipientEmail) {
          return NextResponse.json(
            {
              ok: false,
              error: "Enable the digest only after setting a recipient email.",
            },
            { status: 400 },
          );
        }
      } catch {
        // Fall through to update — engine will surface the storage error.
      }
    }
  }

  try {
    const preferences = await updateNotificationPreferences({
      digestEnabled: parsed.data.digestEnabled,
      digestRecipientEmail:
        normalizedRecipient === undefined ? undefined : normalizedRecipient,
      skipEmptyDigests: parsed.data.skipEmptyDigests,
    });
    const recipientCount = preferences.digestRecipientEmail
      ? preferences.digestRecipientEmail.split(",").map((s) => s.trim()).filter(Boolean).length
      : 0;
    await logAdminAudit(request, {
      action: "contentops_notification_prefs_updated",
      targetType: "contentops_notification_preferences",
      targetId: preferences.id,
      metadata: {
        digestEnabled: preferences.digestEnabled,
        hasRecipient: recipientCount > 0,
        recipientCount,
        skipEmptyDigests: preferences.skipEmptyDigests,
      },
    });
    return NextResponse.json({ ok: true, preferences });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update preferences";
    captureServerError(
      "api_admin_contentops_notification_prefs_update_failed",
      err instanceof Error ? err : new Error(message),
    );
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
