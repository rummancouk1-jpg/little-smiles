// Engine component — sticky publish action bar. Operator-facing.
//
// State-aware: handles both approved and scheduled drafts.
//   - Approved:  [Publish now] [Schedule publish] [optional notes]
//   - Scheduled: [Publish now (override)] [Reschedule] [Cancel schedule]
//
// All flows hit existing engine endpoints. Publish now uses the broadened
// markDraftPublished from Commit M, which accepts approved-or-scheduled
// as the source state. Scheduling uses POST /schedule with a future
// timestamp validated both client- and server-side.

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { formatAbsolute } from "@/components/contentops/relative-time";

type PublishActionProps = {
  draftId: string;
  status: "approved" | "scheduled";
  scheduledAt: string | null;
  ready: boolean;
  publishHref: string;
  scheduleHref: string;
  unscheduleHref: string;
};

type Mode = "idle" | "schedule" | "publishNow";

function nowPlusMinutes(minutes: number): Date {
  return new Date(Date.now() + minutes * 60_000);
}

// HTML datetime-local accepts "YYYY-MM-DDTHH:mm" in the user's local time.
// We build the value from a Date in local-time components, not toISOString.
function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

export function PublishAction({
  draftId,
  status,
  scheduledAt,
  ready,
  publishHref,
  scheduleHref,
  unscheduleHref,
}: PublishActionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<Mode>("idle");
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState("");
  const [scheduleInput, setScheduleInput] = useState(() =>
    toLocalInputValue(nowPlusMinutes(60)),
  );
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setMode("idle");
    setShowNotes(false);
    setNotes("");
    setError(null);
  };

  const submitPublish = () => {
    setError(null);
    const trimmed = notes.trim();
    startTransition(async () => {
      const response = await fetch(publishHref, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(trimmed.length > 0 ? { notes: trimmed } : {}),
      });
      const data = (await response.json().catch(() => null)) as
        | { ok: true; draft: unknown }
        | { ok: false; error: string }
        | null;
      if (!response.ok || !data || data.ok !== true) {
        setError(
          (data && "error" in data && data.error) || "Failed to publish article.",
        );
        return;
      }
      router.refresh();
    });
  };

  const submitSchedule = () => {
    setError(null);
    if (!scheduleInput) {
      setError("Pick a date and time.");
      return;
    }
    const parsed = new Date(scheduleInput);
    if (Number.isNaN(parsed.getTime())) {
      setError("That date/time isn't valid.");
      return;
    }
    if (parsed.getTime() - Date.now() < 60_000) {
      setError("Pick a time at least one minute from now.");
      return;
    }
    const trimmed = notes.trim();
    const body: Record<string, unknown> = { scheduledAt: parsed.toISOString() };
    if (trimmed.length > 0) body.notes = trimmed;
    startTransition(async () => {
      const response = await fetch(scheduleHref, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json().catch(() => null)) as
        | { ok: true; draft: unknown }
        | { ok: false; error: string }
        | null;
      if (!response.ok || !data || data.ok !== true) {
        setError(
          (data && "error" in data && data.error) || "Failed to schedule article.",
        );
        return;
      }
      router.refresh();
    });
  };

  const submitUnschedule = () => {
    setError(null);
    startTransition(async () => {
      const response = await fetch(unscheduleHref, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await response.json().catch(() => null)) as
        | { ok: true; draft: unknown }
        | { ok: false; error: string }
        | null;
      if (!response.ok || !data || data.ok !== true) {
        setError(
          (data && "error" in data && data.error) || "Failed to cancel schedule.",
        );
        return;
      }
      router.refresh();
    });
  };

  // Client-side floor for the picker so past times can't be entered.
  const minScheduleInput = toLocalInputValue(nowPlusMinutes(1));

  const primaryDisabled = !ready || isPending;
  const hint =
    status === "scheduled"
      ? `Scheduled to go live ${scheduledAt ? formatAbsolute(scheduledAt) : "automatically"}.`
      : ready
        ? "Sends the article live across the site in seconds."
        : "Resolve publishing checks above to enable publish.";

  const showScheduleForm = mode === "schedule";

  return (
    <div
      className="sticky bottom-0 z-30 -mx-4 sm:-mx-6 lg:-mx-8"
      data-draft-id={draftId}
    >
      <div className="border-t border-[#3B2F2F]/10 bg-[#FDF8F4]/95 px-4 py-4 backdrop-blur-md sm:px-6 sm:py-5 lg:px-8">
        <div className="mx-auto max-w-4xl space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={submitPublish}
              disabled={primaryDisabled}
              aria-busy={isPending && mode !== "schedule"}
              className="rounded-full bg-[#2F2624] px-5 py-2.5 text-sm font-medium text-[#F6F1EC] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isPending && mode !== "schedule"
                ? "Publishing…"
                : status === "scheduled"
                  ? "Publish now (override)"
                  : "Publish now"}
            </button>

            {status === "approved" ? (
              <button
                type="button"
                onClick={() => setMode(showScheduleForm ? "idle" : "schedule")}
                disabled={primaryDisabled}
                className="rounded-full border border-[#3B2F2F]/14 bg-white px-4 py-2 text-sm font-medium text-[#2E2323] hover:bg-[#F2EAE4] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {showScheduleForm ? "Cancel" : "Schedule publish"}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setMode(showScheduleForm ? "idle" : "schedule")}
                  disabled={isPending}
                  className="rounded-full border border-[#3B2F2F]/14 bg-white px-4 py-2 text-sm font-medium text-[#2E2323] hover:bg-[#F2EAE4] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {showScheduleForm ? "Cancel" : "Reschedule"}
                </button>
                <button
                  type="button"
                  onClick={submitUnschedule}
                  disabled={isPending}
                  className="text-xs text-[#6A3E31] underline underline-offset-2 hover:text-[#5B342B] disabled:opacity-50"
                >
                  Cancel schedule
                </button>
              </>
            )}

            <p className="ml-auto text-xs text-[#3B2F2F]/60">{hint}</p>
          </div>

          {showScheduleForm ? (
            <div className="rounded-2xl border border-[#3B2F2F]/10 bg-white p-4">
              <label
                htmlFor="schedule-at"
                className="text-xs uppercase tracking-[0.12em] text-[#3B2F2F]/55"
              >
                Publish date and time
              </label>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <input
                  id="schedule-at"
                  type="datetime-local"
                  value={scheduleInput}
                  min={minScheduleInput}
                  onChange={(e) => setScheduleInput(e.target.value)}
                  disabled={isPending}
                  className="rounded-xl border border-[#3B2F2F]/12 bg-white px-3 py-2 text-sm text-[#1F1918] focus:border-[#2F2624]/40 focus:outline-none disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={submitSchedule}
                  disabled={isPending}
                  className="rounded-full bg-[#2F2624] px-5 py-2 text-sm font-medium text-[#F6F1EC] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isPending && mode === "schedule"
                    ? "Saving…"
                    : status === "scheduled"
                      ? "Confirm reschedule"
                      : "Confirm schedule"}
                </button>
                <p className="text-xs text-[#3B2F2F]/60">
                  Time is in your local timezone. The cron sweeps every 15 minutes.
                </p>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setShowNotes((prev) => !prev)}
              disabled={isPending}
              className="text-xs text-[#3B2F2F]/65 underline underline-offset-2 hover:text-[#3B2F2F] disabled:opacity-50"
            >
              {showNotes ? "Hide publish note" : "Add publish note (optional)"}
            </button>
          </div>

          {showNotes ? (
            <div className="rounded-2xl border border-[#3B2F2F]/10 bg-white p-4">
              <label
                htmlFor="publish-notes"
                className="text-xs uppercase tracking-[0.12em] text-[#3B2F2F]/55"
              >
                Publish note (optional)
              </label>
              <textarea
                id="publish-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                maxLength={2000}
                disabled={isPending}
                className="mt-2 w-full rounded-xl border border-[#3B2F2F]/12 bg-white p-3 text-sm text-[#1F1918] focus:border-[#2F2624]/40 focus:outline-none disabled:opacity-60"
                placeholder="Anything useful for the audit trail — context, edits made, source."
              />
            </div>
          ) : null}

          {error ? <p className="text-xs text-[#8A2F40]">{error}</p> : null}

          {mode !== "idle" && !isPending ? (
            <button
              type="button"
              onClick={reset}
              className="text-[11px] text-[#3B2F2F]/45 underline underline-offset-2 hover:text-[#3B2F2F]/70"
            >
              Reset form
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
