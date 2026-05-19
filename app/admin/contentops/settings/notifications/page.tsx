// Notifications preferences page. Hosts the calm preferences form and
// nothing else for now — additional notification surfaces (per-event
// reminders, WhatsApp number, digest cadence) will sit alongside it
// here as they're built.

import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminLogoutButton } from "@/components/admin/admin-logout-button";
import { NotificationPreferencesForm } from "@/components/contentops/notification-preferences-form";
import { getAdminSessionFromPage } from "@/lib/admin-auth";
import { adminConfigHelpText, isAdminAuthConfigured } from "@/lib/admin-runtime";
import { getNotificationPreferences } from "@/lib/contentops/notifications/preferences";
import type { NotificationPreferences } from "@/lib/contentops/notifications/types";

export const dynamic = "force-dynamic";

export default async function NotificationsSettingsPage() {
  if (!isAdminAuthConfigured()) {
    return (
      <main className="min-h-screen bg-[#FDF8F4] px-5 py-10 sm:px-6 lg:px-8">
        <section className="mx-auto max-w-3xl rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-7 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-9">
          <h1 className="text-3xl font-semibold tracking-tight text-[#1F1918]">Admin Locked</h1>
          <p className="mt-3 text-sm leading-relaxed text-[#3B2F2F]/72">{adminConfigHelpText()}</p>
        </section>
      </main>
    );
  }

  const adminSession = await getAdminSessionFromPage();
  if (!adminSession) {
    redirect(
      `/admin/login?next=${encodeURIComponent("/admin/contentops/settings/notifications")}`,
    );
  }

  let preferences: NotificationPreferences | null = null;
  let loadError: string | null = null;
  try {
    preferences = await getNotificationPreferences();
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Failed to read preferences.";
  }

  return (
    <main className="min-h-screen bg-[#FDF8F4] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <section className="mx-auto max-w-3xl space-y-6">
        <header className="rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-5 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#3B2F2F]/50">
                Editorial
              </p>
              <p className="mt-1 text-xs text-[#3B2F2F]/65">
                Signed in as {adminSession.actorLabel}
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#1F1918] sm:text-4xl">
                Notifications
              </h1>
              <p className="mt-2 text-sm text-[#3B2F2F]/65">
                One calm email each morning. Helpful, not loud.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/admin/contentops"
                className="rounded-full border border-[#3B2F2F]/14 bg-[#EEE4DB] px-3.5 py-1.5 text-xs font-medium text-[#2E2323] hover:bg-[#E7DBD1]"
              >
                Back to overview
              </Link>
              <AdminLogoutButton />
            </div>
          </div>
        </header>

        {loadError ? (
          <article className="rounded-3xl border border-[#8A2F40]/20 bg-[#FBEEF1] p-5 text-sm text-[#5E1C29] sm:p-6">
            <p className="font-medium">Unable to load preferences</p>
            <p className="mt-1 text-xs">{loadError}</p>
          </article>
        ) : preferences ? (
          <NotificationPreferencesForm initialPreferences={preferences} />
        ) : null}
      </section>
    </main>
  );
}
