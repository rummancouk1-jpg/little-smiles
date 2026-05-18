// Engine component — sticky publish action bar. Operator-facing.
//
// Layout intent (Commit I): this is the publishing control center. Three
// slots in a single bar — the wired "Confirm it's live" plus two
// disabled placeholders for "Publish now" and "Schedule publish" that
// land wired in Commits L and M respectively. Disabled buttons set the
// visual expectation early so the bar doesn't restructure when those
// commits ship.
//
// When ready=false, the entire bar disables and shows a single hint line
// pointing back at the publishing checks above. The bar still renders so
// the operator's mental model — "the controls are always here at the
// bottom" — stays stable across states.

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
  const [showForm, setShowForm] = useState(false);
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
        setError((data && "error" in data && data.error) || "Failed to mark draft published.");
        return;
      }
      router.refresh();
    });
  };

  const primaryDisabled = !ready || isPending;

  return (
    <div
      className="sticky bottom-0 z-30 -mx-4 sm:-mx-6 lg:-mx-8"
      data-draft-id={draftId}
    >
      <div className="border-t border-[#3B2F2F]/10 bg-[#FDF8F4]/95 px-4 py-4 backdrop-blur-md sm:px-6 sm:py-5 lg:px-8">
        <div className="mx-auto max-w-4xl space-y-3">
          {showForm ? (
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
                className="mt-2 w-full rounded-xl border border-[#3B2F2F]/12 bg-white p-3 text-sm text-[#1F1918] focus:border-[#2F2624]/40 focus:outline-none"
                placeholder="Anything useful for the audit trail — deploy SHA, PR link."
              />
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (showForm) {
                    handlePublish();
                  } else {
                    setShowForm(true);
                  }
                }}
                disabled={primaryDisabled}
                className="rounded-full bg-[#2F2624] px-5 py-2.5 text-sm font-medium text-[#F6F1EC] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isPending ? "Saving…" : showForm ? "Confirm" : "Confirm it's live"}
              </button>
              {showForm ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setNotes("");
                    setError(null);
                  }}
                  disabled={isPending}
                  className="rounded-full border border-[#3B2F2F]/14 bg-white px-4 py-2 text-sm font-medium text-[#2E2323] hover:bg-[#F2EAE4] disabled:opacity-50"
                >
                  Cancel
                </button>
              ) : null}
            </div>

            <span className="hidden h-6 w-px bg-[#3B2F2F]/12 sm:inline-block" aria-hidden />

            <button
              type="button"
              disabled
              title="Coming soon — instant publishing without a deploy"
              className="rounded-full border border-[#3B2F2F]/14 bg-white/60 px-4 py-2 text-sm font-medium text-[#3B2F2F]/45 disabled:cursor-not-allowed"
            >
              Publish now
              <span className="ml-2 rounded-full bg-[#3B2F2F]/8 px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] text-[#3B2F2F]/60">
                soon
              </span>
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

            <p className="ml-auto text-xs text-[#3B2F2F]/60">
              {ready
                ? "After the article is live on the site, confirm here to retire the draft."
                : "Resolve publishing checks above to enable publish."}
            </p>
          </div>

          {error ? <p className="text-xs text-[#8A2F40]">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
