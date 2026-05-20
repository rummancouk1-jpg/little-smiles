// "Generate with AI" action. Drop-in companion to the MediaUploader's
// drag-drop / Replace controls — same calm chrome, same operator flow.
// Lives in its own file so the upload component doesn't grow.

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import type { BlogImageSlot } from "@/lib/contentops/blog-schema";

type Props = {
  draftId: string;
  slot: BlogImageSlot;
  /** True if a provider is configured server-side. Drives disabled + tooltip. */
  providerConfigured: boolean;
  /** Operator-friendly button label per slot. */
  label: string;
};

// HTTP status codes that are worth one automatic retry. 502/503/504 are
// transient gateway / upstream availability; 429 we back off more
// aggressively because the upstream is rate-limiting us.
const TRANSIENT_STATUSES = new Set<number>([429, 502, 503, 504]);
const MAX_AUTO_RETRIES = 1;
// Generation is allowed to take a calm 90 seconds. Past that we abort
// and surface a clear timeout message so the operator can retry rather
// than wait on a hanging spinner.
const REQUEST_TIMEOUT_MS = 90_000;

type Phase = "idle" | "generating" | "retrying" | "error";

export function ImageGenerateButton({
  draftId,
  slot,
  providerConfigured,
  label,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState<number>(0);
  const startedAtRef = useRef<number | null>(null);

  // Visible elapsed-seconds counter while generation is in flight. Pure
  // operator reassurance — the API call doesn't itself stream progress.
  // We deliberately don't reset elapsed when the phase leaves
  // generating/retrying because elapsed is only rendered in those phases
  // (see buttonLabel below). Avoids the cascading-render lint warning
  // around setState-in-effect.
  useEffect(() => {
    if (phase !== "generating" && phase !== "retrying") {
      startedAtRef.current = null;
      return;
    }
    startedAtRef.current = Date.now();
    const iv = window.setInterval(() => {
      if (startedAtRef.current === null) return;
      setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 1000);
    return () => window.clearInterval(iv);
  }, [phase]);

  async function attempt(): Promise<
    | { ok: true }
    | { ok: false; retryable: boolean; error: string }
  > {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(
        `/api/admin/contentops/drafts/${draftId}/images/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slot }),
          signal: controller.signal,
        },
      );
      const data = (await response.json().catch(() => null)) as
        | { ok: true; provider: string }
        | { ok: false; error: string }
        | null;
      if (response.ok && data && data.ok === true) return { ok: true };
      const message =
        (data && "error" in data && data.error) || "Image generation failed.";
      return {
        ok: false,
        retryable: TRANSIENT_STATUSES.has(response.status),
        error: message,
      };
    } catch (err) {
      const aborted =
        err instanceof DOMException && err.name === "AbortError";
      return {
        ok: false,
        retryable: !aborted,
        error: aborted
          ? `Generation timed out after ${Math.floor(REQUEST_TIMEOUT_MS / 1000)}s. The provider may still finish — refresh in a minute before retrying.`
          : "Network problem during generation.",
      };
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  const run = () => {
    if (!providerConfigured) {
      setError("No image provider is configured. Set IMAGE_PROVIDER and an API key.");
      setPhase("error");
      return;
    }
    setError(null);
    setElapsed(0);
    setPhase("generating");
    startTransition(async () => {
      const first = await attempt();
      if (first.ok) {
        setPhase("idle");
        router.refresh();
        return;
      }
      if (first.retryable && MAX_AUTO_RETRIES > 0) {
        // Single calm auto-retry with a short backoff. Keeps the
        // operator from having to babysit transient upstream blips.
        setPhase("retrying");
        await new Promise((r) => window.setTimeout(r, 2500));
        const second = await attempt();
        if (second.ok) {
          setPhase("idle");
          router.refresh();
          return;
        }
        setError(second.error);
        setPhase("error");
        return;
      }
      setError(first.error);
      setPhase("error");
    });
  };

  const buttonLabel =
    phase === "generating"
      ? `Generating… ${elapsed}s`
      : phase === "retrying"
        ? `Retrying… ${elapsed}s`
        : phase === "error"
          ? "Retry"
          : label;

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={run}
        disabled={isPending}
        aria-busy={isPending}
        className="rounded-full border border-[#3B2F2F]/14 bg-white px-4 py-2 text-sm font-medium text-[#2E2323] hover:bg-[#F2EAE4] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {buttonLabel}
      </button>
      {!providerConfigured ? (
        <p className="text-[11px] text-[#3B2F2F]/55">
          Configure <span className="font-mono">IMAGE_PROVIDER</span> to enable.
        </p>
      ) : null}
      {error ? <p className="text-[11px] text-[#8A2F40]">{error}</p> : null}
    </div>
  );
}
