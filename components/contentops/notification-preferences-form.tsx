// Operator-facing notification preferences form. Three controls:
//   - digest_enabled  (toggle)
//   - digest_recipient_email (text input)
//   - skip_empty_digests (toggle)
//
// Plus a "Send a test digest" action that uses the current preferences
// to dispatch immediately. Calm, compact, editorial — no enterprise
// settings clutter.

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { NotificationPreferences } from "@/lib/contentops/notifications/types";

type NotificationPreferencesFormProps = {
  initialPreferences: NotificationPreferences;
};

const PREFS_HREF = "/api/admin/contentops/notifications/preferences";
const SEND_TEST_HREF = "/api/admin/contentops/notifications/send-digest";

export function NotificationPreferencesForm({
  initialPreferences,
}: NotificationPreferencesFormProps) {
  const router = useRouter();
  const [savePending, startSave] = useTransition();
  const [testPending, startTest] = useTransition();
  const [digestEnabled, setDigestEnabled] = useState(
    initialPreferences.digestEnabled,
  );
  const [recipient, setRecipient] = useState(
    initialPreferences.digestRecipientEmail ?? "",
  );
  const [skipEmpty, setSkipEmpty] = useState(initialPreferences.skipEmptyDigests);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const dirty =
    digestEnabled !== initialPreferences.digestEnabled ||
    recipient !== (initialPreferences.digestRecipientEmail ?? "") ||
    skipEmpty !== initialPreferences.skipEmptyDigests;

  const canSave = dirty && !savePending && !testPending;
  const canSendTest =
    !!recipient.trim() && !savePending && !testPending && !dirty;

  const handleSave = () => {
    setError(null);
    setInfo(null);
    startSave(async () => {
      let response: Response;
      try {
        response = await fetch(PREFS_HREF, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            digestEnabled,
            digestRecipientEmail: recipient.trim() || null,
            skipEmptyDigests: skipEmpty,
          }),
        });
      } catch {
        setError("Network problem. Try again.");
        return;
      }
      const data = (await response.json().catch(() => null)) as
        | { ok: true; preferences: unknown }
        | { ok: false; error: string }
        | null;
      if (!response.ok || !data || data.ok !== true) {
        setError(
          (data && "error" in data && data.error) ||
            "Failed to save preferences.",
        );
        return;
      }
      setInfo("Preferences saved.");
      router.refresh();
    });
  };

  const handleSendTest = () => {
    setError(null);
    setInfo(null);
    startTest(async () => {
      let response: Response;
      try {
        response = await fetch(SEND_TEST_HREF, { method: "POST" });
      } catch {
        setError("Network problem during send. Try again.");
        return;
      }
      const data = (await response.json().catch(() => null)) as
        | { ok: true; messageId?: string; emptyState?: boolean }
        | { ok: false; error: string }
        | null;
      if (!response.ok || !data || data.ok !== true) {
        setError(
          (data && "error" in data && data.error) ||
            "Failed to send test digest.",
        );
        return;
      }
      setInfo(
        data.emptyState
          ? "Test digest sent — calm-day version (nothing pressing)."
          : "Test digest sent. Check your inbox in a minute.",
      );
    });
  };

  return (
    <article className="rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-7 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-9">
      <div className="space-y-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#3B2F2F]/55">
            Daily editorial digest
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[#3B2F2F]/72">
            One calm email each morning summarizing what&rsquo;s waiting for your
            review, what&rsquo;s ready to publish, what&rsquo;s scheduled this week, and
            anything that needs a gentle nudge. Goes out at 08:30 PKT.
          </p>
        </div>

        <label className="flex items-start gap-3 rounded-2xl border border-[#3B2F2F]/10 bg-[#FBF7F3] p-4">
          <input
            type="checkbox"
            checked={digestEnabled}
            onChange={(e) => setDigestEnabled(e.target.checked)}
            disabled={savePending}
            className="mt-1 h-4 w-4 cursor-pointer accent-[#2F2624]"
          />
          <span>
            <span className="block text-sm font-medium text-[#1F1918]">
              Send the daily digest
            </span>
            <span className="mt-1 block text-xs text-[#3B2F2F]/72">
              Off by default. Turn on after you&rsquo;ve set a recipient below.
            </span>
          </span>
        </label>

        <div>
          <label
            htmlFor="recipient"
            className="text-xs font-medium uppercase tracking-[0.12em] text-[#3B2F2F]/55"
          >
            Recipient email
          </label>
          <input
            id="recipient"
            type="email"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            disabled={savePending}
            placeholder="you@example.com"
            className="mt-2 w-full rounded-xl border border-[#3B2F2F]/12 bg-white px-3 py-2 text-sm text-[#1F1918] focus:border-[#2F2624]/40 focus:outline-none disabled:opacity-60"
          />
          <p className="mt-1 text-xs text-[#3B2F2F]/55">
            One recipient for now. Multi-recipient and WhatsApp delivery land in
            a future release.
          </p>
        </div>

        <label className="flex items-start gap-3 rounded-2xl border border-[#3B2F2F]/10 bg-[#FBF7F3] p-4">
          <input
            type="checkbox"
            checked={skipEmpty}
            onChange={(e) => setSkipEmpty(e.target.checked)}
            disabled={savePending}
            className="mt-1 h-4 w-4 cursor-pointer accent-[#2F2624]"
          />
          <span>
            <span className="block text-sm font-medium text-[#1F1918]">
              Skip empty days
            </span>
            <span className="mt-1 block text-xs text-[#3B2F2F]/72">
              When nothing&rsquo;s pending and nothing shipped in the last 7 days,
              don&rsquo;t send. Keeps the inbox calm.
            </span>
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            aria-busy={savePending}
            className="rounded-full bg-[#2F2624] px-5 py-2.5 text-sm font-medium text-[#F6F1EC] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {savePending ? "Saving…" : "Save preferences"}
          </button>
          <button
            type="button"
            onClick={handleSendTest}
            disabled={!canSendTest}
            aria-busy={testPending}
            className="rounded-full border border-[#3B2F2F]/14 bg-white px-5 py-2.5 text-sm font-medium text-[#2E2323] hover:bg-[#F2EAE4] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {testPending ? "Sending…" : "Send a test digest"}
          </button>
          {dirty ? (
            <p className="text-xs text-[#3B2F2F]/55">
              Save first to use the current values for the test send.
            </p>
          ) : null}
        </div>

        {error ? (
          <p className="rounded-2xl border border-[#8A2F40]/20 bg-[#FBEEF1] p-3 text-xs text-[#5E1C29]">
            {error}
          </p>
        ) : null}
        {info ? (
          <p className="rounded-2xl border border-[#2E6A41]/20 bg-[#EAF5EE] p-3 text-xs text-[#1E5A37]">
            {info}
          </p>
        ) : null}
      </div>
    </article>
  );
}
