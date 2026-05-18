// Engine component — client-side reviewer actions for a single draft.
// Receives action endpoints as props so wiring layer controls the URLs.

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { type DraftStatus } from "@/lib/contentops/drafts-store";

type DraftActionsProps = {
  draftId: string;
  status: DraftStatus;
  approveHref: string;
  rejectHref: string;
  backHref: string;
};

export function DraftActions({ draftId, status, approveHref, rejectHref, backHref }: DraftActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const canReview = status === "pending_review";

  const handleApprove = () => {
    setError(null);
    startTransition(async () => {
      const response = await fetch(approveHref, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await response.json().catch(() => null)) as
        | { ok: true; draft: unknown }
        | { ok: false; error: string }
        | null;
      if (!response.ok || !data || data.ok !== true) {
        setError((data && "error" in data && data.error) || "Failed to approve draft.");
        return;
      }
      router.refresh();
    });
  };

  const handleReject = () => {
    setError(null);
    const trimmed = note.trim();
    startTransition(async () => {
      const response = await fetch(rejectHref, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(trimmed.length > 0 ? { note: trimmed } : {}),
      });
      const data = (await response.json().catch(() => null)) as
        | { ok: true; draft: unknown }
        | { ok: false; error: string }
        | null;
      if (!response.ok || !data || data.ok !== true) {
        setError((data && "error" in data && data.error) || "Failed to reject draft.");
        return;
      }
      setShowRejectForm(false);
      setNote("");
      router.refresh();
    });
  };

  return (
    <div
      className="rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-5 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-6"
      data-draft-id={draftId}
    >
      {canReview ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleApprove}
              disabled={isPending}
              className="rounded-full bg-[#2F2624] px-5 py-2 text-sm font-medium text-[#F6F1EC] transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isPending ? "Saving…" : "Approve"}
            </button>
            <button
              type="button"
              onClick={() => setShowRejectForm((prev) => !prev)}
              disabled={isPending}
              className="rounded-full border border-[#3B2F2F]/14 bg-white px-5 py-2 text-sm font-medium text-[#2E2323] hover:bg-[#F2EAE4] disabled:opacity-50"
            >
              {showRejectForm ? "Cancel" : "Reject"}
            </button>
            <a href={backHref} className="ml-auto text-xs text-[#3B2F2F]/72 underline underline-offset-2">
              Back to queue
            </a>
          </div>

          {showRejectForm ? (
            <div className="space-y-2">
              <label
                htmlFor="rejection-note"
                className="text-xs uppercase tracking-[0.12em] text-[#3B2F2F]/55"
              >
                Rejection note (optional)
              </label>
              <textarea
                id="rejection-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={2000}
                className="w-full rounded-2xl border border-[#3B2F2F]/12 bg-white p-3 text-sm text-[#1F1918] focus:border-[#2F2624]/40 focus:outline-none"
                placeholder="Why is this draft being rejected? Optional."
              />
              <button
                type="button"
                onClick={handleReject}
                disabled={isPending}
                className="rounded-full bg-[#6A3E31] px-5 py-2 text-sm font-medium text-[#F6F1EC] transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {isPending ? "Saving…" : "Confirm rejection"}
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <p className="text-sm text-[#3B2F2F]/72">
            No reviewer actions for {status.replace("_", " ")} drafts.
          </p>
          <a href={backHref} className="text-xs text-[#3B2F2F]/72 underline underline-offset-2">
            Back to queue
          </a>
        </div>
      )}

      {error ? <p className="mt-3 text-xs text-[#8A2F40]">{error}</p> : null}
    </div>
  );
}
