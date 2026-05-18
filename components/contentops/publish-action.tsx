// Engine component — sticky publish action bar. Operator-facing.
//
// Commit L turned this from a manual-confirmation surface into a true
// publishing control. "Publish now" calls the same API as before
// (POST /api/admin/contentops/drafts/[id]/publish) but the API now
// triggers on-demand revalidation, so the article is visible on the
// public site within seconds via the Commit K hybrid read path. The
// disabled "Schedule publish" slot remains a placeholder for Commit M.
//
// Notes:
//  - The button is disabled while ready=false (publishing checks have
//    unresolved errors above) and while the request is pending.
//  - publish_notes are optional and live behind a small disclosure so
//    the default action is one click. Audit log captures who+when
//    regardless of whether notes are supplied.
//  - On success, router.refresh() reloads the page, which then renders
//    the "Already live" branch with the "View live article" link
//    introduced in Commit J. That closes the verification loop.

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type PublishActionProps = {
  draftId: string;
  publishHref: string;
  ready: boolean;
};

export function PublishAction({ draftId, publishHref, ready }: PublishActionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handlePublish = () => {
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
      // Success: refresh to render the "Already live" branch with the
      // View live article link.
      router.refresh();
    });
  };

  const primaryDisabled = !ready || isPending;
  const hint = ready
    ? "Sends the article live across the site in seconds."
    : "Resolve publishing checks above to enable publish.";

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
              onClick={handlePublish}
              disabled={primaryDisabled}
              aria-busy={isPending}
              className="rounded-full bg-[#2F2624] px-5 py-2.5 text-sm font-medium text-[#F6F1EC] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isPending ? "Publishing…" : "Publish now"}
            </button>

            <button
              type="button"
              disabled
              title="Coming soon — schedule a future publish time"
              className="rounded-full border border-[#3B2F2F]/14 bg-white/60 px-4 py-2 text-sm font-medium text-[#3B2F2F]/45 disabled:cursor-not-allowed"
            >
              Schedule publish
              <span className="ml-2 rounded-full bg-[#3B2F2F]/8 px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] text-[#3B2F2F]/60">
                soon
              </span>
            </button>

            <p className="ml-auto text-xs text-[#3B2F2F]/60">{hint}</p>
          </div>

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
        </div>
      </div>
    </div>
  );
}
