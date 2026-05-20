// Per-card actions for a topic. Operator paths by status:
//   queued    → Generate draft (primary)
//             · Save for later
//             · Mark as seasonal priority
//             · Mark low priority (when not already low)
//             · Archive
//   snoozed   → Bring back (un-snooze)
//             · Archive
//   drafted   → Archive  (view-draft link lives on the card body)
//   published → (no destructive actions; view-article link on card)
//   archived  → (no actions)
//
// Generation takes 15-30 seconds; the primary button enters a "Writing
// draft…" state during the wait. Other actions complete quickly with
// router.refresh() to repaint the queue with the new state.

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

  const post = async (path: string, body?: Record<string, unknown>) => {
    return fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
  };

  const handleResponse = async <T,>(
    response: Response,
    fallbackError: string,
  ): Promise<{ ok: true; data: T } | { ok: false; error: string }> => {
    const raw = (await response.json().catch(() => null)) as
      | (Record<string, unknown> & { ok: boolean; error?: string })
      | null;
    if (!response.ok || !raw || raw.ok !== true) {
      return {
        ok: false,
        error: (raw && typeof raw.error === "string" && raw.error) || fallbackError,
      };
    }
    return { ok: true, data: raw as unknown as T };
  };

  const callGenerate = () => {
    setError(null);
    setInfo(null);
    startTransition(async () => {
      let response: Response;
      try {
        response = await post(
          `/api/admin/contentops/topics/${topicId}/generate-draft`,
        );
      } catch {
        setError(
          "Network problem during generation. If you waited the full minute, check the editorial queue — the draft may have landed anyway.",
        );
        return;
      }
      const result = await handleResponse<{
        draft: { id: string; slug: string; title: string };
        topicLinkWarning?: string;
      }>(response, "Generation failed. Try a slightly different topic.");
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.data.topicLinkWarning) {
        setInfo(result.data.topicLinkWarning);
      }
      router.push(`/admin/contentops/${result.data.draft.id}`);
    });
  };

  const simpleAction = (
    path: string,
    body: Record<string, unknown> | undefined,
    networkErrorCopy: string,
    fallbackErrorCopy: string,
    onSuccess?: () => void,
  ) => {
    setError(null);
    setInfo(null);
    startTransition(async () => {
      let response: Response;
      try {
        response = await post(path, body);
      } catch {
        setError(networkErrorCopy);
        return;
      }
      const result = await handleResponse<{ topic: unknown }>(
        response,
        fallbackErrorCopy,
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSuccess?.();
      router.refresh();
    });
  };

  const callArchive = () =>
    simpleAction(
      `/api/admin/contentops/topics/${topicId}/archive`,
      undefined,
      "Network problem during archive. Try again.",
      "Archive failed.",
      () => setConfirmingArchive(false),
    );

  const callLowerPriority = () =>
    simpleAction(
      `/api/admin/contentops/topics/${topicId}/priority`,
      { priority: "low" },
      "Network problem. Try again.",
      "Failed to update priority.",
    );

  const callSnooze = () =>
    simpleAction(
      `/api/admin/contentops/topics/${topicId}/snooze`,
      undefined,
      "Network problem. Try again.",
      "Failed to save for later.",
    );

  const callUnsnooze = () =>
    simpleAction(
      `/api/admin/contentops/topics/${topicId}/unsnooze`,
      undefined,
      "Network problem. Try again.",
      "Failed to bring topic back.",
    );

  const callSeasonalPriority = () =>
    simpleAction(
      `/api/admin/contentops/topics/${topicId}/seasonal-priority`,
      undefined,
      "Network problem. Try again.",
      "Failed to mark seasonal priority.",
    );

  const canGenerate = status === "queued";
  const canSnooze = status === "queued";
  const canSeasonal = status === "queued" && priority !== "high";
  const canDemote = status === "queued" && priority !== "low";
  const canUnsnooze = status === "snoozed";
  const canArchive =
    status === "queued" ||
    status === "snoozed" ||
    status === "drafted" ||
    status === "published";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
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

        {canUnsnooze ? (
          <button
            type="button"
            onClick={callUnsnooze}
            disabled={isPending}
            className="rounded-full border border-[#3B2F2F]/14 bg-white px-4 py-2 text-sm font-medium text-[#2E2323] hover:bg-[#F2EAE4] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Bring back
          </button>
        ) : null}

        {canSeasonal ? (
          <button
            type="button"
            onClick={callSeasonalPriority}
            disabled={isPending}
            className="text-xs text-[#3B2F2F]/65 underline underline-offset-2 hover:text-[#3B2F2F] disabled:opacity-50"
          >
            Mark seasonal priority
          </button>
        ) : null}

        {canSnooze ? (
          <button
            type="button"
            onClick={callSnooze}
            disabled={isPending}
            className="text-xs text-[#3B2F2F]/65 underline underline-offset-2 hover:text-[#3B2F2F] disabled:opacity-50"
          >
            Save for later
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
