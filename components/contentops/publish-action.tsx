// Engine component — client-side "mark as published" action. The reviewer
// pastes the diff and ships it; only after the deploy is live does this
// button get clicked. publishHref is supplied by the wiring layer so the
// engine stays project-agnostic.

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type PublishActionProps = {
  draftId: string;
  publishHref: string;
};

export function PublishAction({ draftId, publishHref }: PublishActionProps) {
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

  return (
    <section
      className="rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-7 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-9"
      data-draft-id={draftId}
    >
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#3B2F2F]/55">
        Step 2 — after deploy
      </p>
      <p className="mt-2 text-sm text-[#1F1918]">
        Once the diff is pasted into <span className="font-mono">lib/blog.ts</span>, committed,
        and the Vercel deploy is live, mark the draft published here to retire it from the queue.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            if (showForm) {
              handlePublish();
            } else {
              setShowForm(true);
            }
          }}
          disabled={isPending}
          className="rounded-full bg-[#2F2624] px-5 py-2 text-sm font-medium text-[#F6F1EC] transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? "Saving…" : showForm ? "Confirm publish" : "Mark as published"}
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
            className="rounded-full border border-[#3B2F2F]/14 bg-white px-5 py-2 text-sm font-medium text-[#2E2323] hover:bg-[#F2EAE4] disabled:opacity-50"
          >
            Cancel
          </button>
        ) : null}
      </div>

      {showForm ? (
        <div className="mt-4 space-y-2">
          <label
            htmlFor="publish-notes"
            className="text-xs uppercase tracking-[0.12em] text-[#3B2F2F]/55"
          >
            Publish notes (optional — e.g. deploy SHA, link to PR)
          </label>
          <textarea
            id="publish-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            maxLength={2000}
            className="w-full rounded-2xl border border-[#3B2F2F]/12 bg-white p-3 text-sm text-[#1F1918] focus:border-[#2F2624]/40 focus:outline-none"
            placeholder="Optional note retained on the draft record."
          />
        </div>
      ) : null}

      {error ? <p className="mt-3 text-xs text-[#8A2F40]">{error}</p> : null}
    </section>
  );
}
