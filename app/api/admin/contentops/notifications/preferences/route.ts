import { NextResponse } from "next/server";
import { z } from "zod";

import { isAuthorizedAdminRequest } from "@/lib/admin-auth";
import { logAdminAudit } from "@/lib/admin-audit";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "@/lib/contentops/notifications/preferences";
import { captureServerError } from "@/lib/error-observability";

const putSchema = z.object({
  digestEnabled: z.boolean().optional(),
  digestRecipientEmail: z.string().email().or(z.literal("")).nullable().optional(),
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

  // Gate: digest_enabled=true requires a recipient email.
  if (parsed.data.digestEnabled === true) {
    // Need to know current recipient OR new recipient to enable.
    const incomingEmail =
      typeof parsed.data.digestRecipientEmail === "string"
        ? parsed.data.digestRecipientEmail.trim()
        : null;
    if (incomingEmail === null || incomingEmail.length === 0) {
      // Check current value before refusing.
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
        parsed.data.digestRecipientEmail === undefined
          ? undefined
          : parsed.data.digestRecipientEmail,
      skipEmptyDigests: parsed.data.skipEmptyDigests,
    });
    await logAdminAudit(request, {
      action: "contentops_notification_prefs_updated",
      targetType: "contentops_notification_preferences",
      targetId: preferences.id,
      metadata: {
        digestEnabled: preferences.digestEnabled,
        hasRecipient: Boolean(preferences.digestRecipientEmail),
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
