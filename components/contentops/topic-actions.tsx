// Per-card actions for a topic. Three operator paths:
//   - Generate draft → POSTs to the topic's generate-draft endpoint,
//     redirects to the new draft's review page on success.
//   - Mark low priority → demotes priority to 'low'. Only shown when
//     the topic isn't already low.
//   - Archive → inline confirmation, then archives. Only shown when
//     the topic isn't already archived.
//
// Generation takes 15-30 seconds; the primary button enters a "Writing
// draft…" state during the wait. Network failures hint that the draft
// may have landed in the queue anyway.

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type {
  TopicPriority,
  TopicStatus,
} from "@/lib/contentops/topics-store";

type TopicActionsProps = {
  topicId: string;
  status: TopicStatus;
  priority: TopicPriority;
};

export function TopicActions({ topicId, status, priority }: TopicActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const callGenerate = () => {
    setError(null);
    setInfo(null);
    startTransition(async () => {
      let response: Response;
      try {
        response = await fetch(
          `/api/admin/contentops/topics/${topicId}/generate-draft`,
          { method: "POST" },
        );
      } catch {
        setError(
          "Network problem during generation. If you waited the full minute, check the editorial queue — the draft may have landed anyway.",
        );
        return;
      }
      const data = (await response.json().catch(() => null)) as
        | {
            ok: true;
            draft: { id: string; slug: string; title: string };
            topicLinkWarning?: string;
          }
        | { ok: false; error: string }
        | null;
      if (!response.ok || !data || data.ok !== true) {
        setError(
          (data && "error" in data && data.error) ||
            "Generation failed. Try a slightly different topic.",
        );
        return;
      }
      if (data.topicLinkWarning) {
        // Soft warning: draft exists, link missing. Operator can still
        // proceed.
        setInfo(data.topicLinkWarning);
      }
      router.push(`/admin/contentops/${data.draft.id}`);
    });
  };

  const callArchive = () => {
    setError(null);
    setInfo(null);
    startTransition(async () => {
      let response: Response;
      try {
        response = await fetch(
          `/api/admin/contentops/topics/${topicId}/archive`,
          { method: "POST" },
        );
      } catch {
        setError("Network problem during archive. Try again.");
        return;
      }
      const data = (await response.json().catch(() => null)) as
        | { ok: true; topic: unknown }
        | { ok: false; error: string }
        | null;
      if (!response.ok || !data || data.ok !== true) {
        setError(
          (data && "error" in data && data.error) || "Archive failed.",
        );
        return;
      }
      setConfirmingArchive(false);
      router.refresh();
    });
  };

  const callLowerPriority = () => {
    setError(null);
    setInfo(null);
    startTransition(async () => {
      let response: Response;
      try {
        response = await fetch(
          `/api/admin/contentops/topics/${topicId}/priority`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ priority: "low" }),
          },
        );
      } catch {
        setError("Network problem. Try again.");
        return;
      }
      const data = (await response.json().catch(() => null)) as
        | { ok: true; topic: unknown }
        | { ok: false; error: string }
        | null;
      if (!response.ok || !data || data.ok !== true) {
        setError(
          (data && "error" in data && data.error) ||
            "Failed to update priority.",
        );
        return;
      }
      router.refresh();
    });
  };

  const canGenerate = status === "queued";
  const canArchive = status !== "archived";
  const canDemote = status === "queued" && priority !== "low";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {canGenerate ? (
          <button
            type="button"
            onClick={callGenerate}
            disabled={isPending}
            aria-busy={isPending}
            className="rounded-full bg-[#2F2624] px-4 py-2 text-sm font-medium text-[#F6F1EC] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isPending ? "Writing draft…" : "Generate draft"}
          </button>
        ) : null}

        {canDemote ? (
          <button
            type="button"
            onClick={callLowerPriority}
            disabled={isPending}
            className="text-xs text-[#3B2F2F]/65 underline underline-offset-2 hover:text-[#3B2F2F] disabled:opacity-50"
          >
            Mark low priority
          </button>
        ) : null}

        {canArchive ? (
          confirmingArchive ? (
            <>
              <button
                type="button"
                onClick={callArchive}
                disabled={isPending}
                className="rounded-full bg-[#6A3E31] px-3.5 py-1.5 text-xs font-medium text-[#F6F1EC] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPending ? "Archiving…" : "Confirm archive"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingArchive(false)}
                disabled={isPending}
                className="text-xs text-[#3B2F2F]/65 underline underline-offset-2 hover:text-[#3B2F2F]"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingArchive(true)}
              disabled={isPending}
              className="text-xs text-[#6A3E31] underline underline-offset-2 hover:text-[#5B342B] disabled:opacity-50"
            >
              Archive
            </button>
          )
        ) : null}
      </div>

      {info ? <p className="text-xs text-[#5E4A1C]">{info}</p> : null}
      {error ? <p className="text-xs text-[#8A2F40]">{error}</p> : null}
    </div>
  );
}
