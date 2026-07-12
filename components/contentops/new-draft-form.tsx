// Engine component — client-side "New draft" generator for the queue.
// Sends a topic to the server route, which runs the SAME drafting pipeline
// the CLI runs (raised-floor prompt → Zod → duplicate guard → Opus critique →
// insert). API keys stay server-side; this component only knows the endpoint.

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const TOPIC_MIN = 5;
const TOPIC_MAX = 200;

// Cycled while the request is in flight so the operator sees forward motion
// during the ~30-60s generation (draft + Opus critique). Cosmetic only — the
// server does the real work and the final result is authoritative.
const PROGRESS_PHASES = [
  "Checking the corpus for overlap…",
  "Drafting the post (600–800 words, FAQ, links)…",
  "Validating structure and internal links…",
  "Running the Opus critique pass…",
  "Saving to the review queue…",
];

type GenerateResponse =
  | {
      ok: true;
      draft: { id: string; slug: string; title: string };
      warnings: string[];
      critiqueFlags: number;
    }
  | { ok: false; error: string; code?: string };

type NewDraftFormProps = {
  /** POST endpoint that runs the shared drafting pipeline. */
  generateHref: string;
  /** Base path for a draft's review page; the new id is appended as `${base}/${id}`. */
  detailBaseHref: string;
};

export function NewDraftForm({ generateHref, detailBaseHref }: NewDraftFormProps) {
  const detailHref = (id: string) => `${detailBaseHref}/${id}`;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [phase, setPhase] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ title: string; id: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Advance the progress phase on a timer only while generating. Phase is
  // reset to 0 in handleGenerate (not here) to avoid a synchronous setState
  // in the effect body.
  useEffect(() => {
    if (!isGenerating) return;
    const timer = setInterval(() => {
      setPhase((p) => Math.min(p + 1, PROGRESS_PHASES.length - 1));
    }, 6000);
    return () => clearInterval(timer);
  }, [isGenerating]);

  const trimmed = topic.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < TOPIC_MIN;
  const canSubmit = trimmed.length >= TOPIC_MIN && trimmed.length <= TOPIC_MAX && !isGenerating;

  const handleOpen = () => {
    setOpen(true);
    setError(null);
    setSuccess(null);
    // Focus the input after it mounts.
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleGenerate = async () => {
    if (!canSubmit) return;
    setError(null);
    setSuccess(null);
    setPhase(0);
    setIsGenerating(true);
    try {
      const response = await fetch(generateHref, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: trimmed }),
      });
      const data = (await response.json().catch(() => null)) as GenerateResponse | null;
      if (!response.ok || !data || data.ok !== true) {
        setError(
          (data && "error" in data && data.error) ||
            "Generation failed. Please try again in a moment.",
        );
        return;
      }
      // Draft is in the queue as pending_review. Surface it, refresh the
      // queue behind us, and send the operator straight to review.
      setSuccess({ title: data.draft.title, id: data.draft.id });
      setTopic("");
      router.refresh();
      router.push(detailHref(data.draft.id));
    } catch {
      setError("Network error — the draft may not have been created. Check the queue.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && canSubmit) {
      e.preventDefault();
      void handleGenerate();
    }
  };

  if (!open) {
    return (
      <div className="rounded-3xl border border-ink-base/10 bg-surface-card/90 p-5 shadow-card-rest sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-heading text-lg font-semibold text-ink-strong">Generate a new draft</h2>
            <p className="mt-0.5 text-xs text-ink-base/65">
              Type a parent question or topic — the full drafting pipeline runs server-side and
              drops a pending-review draft into the queue.
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpen}
            className="shrink-0 rounded-full bg-ink-walnut px-4 py-2 text-sm font-medium text-ink-foreground hover:bg-ink-espresso"
          >
            + New draft
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-ink-base/10 bg-surface-card/90 p-5 shadow-card-rest sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-semibold text-ink-strong">Generate a new draft</h2>
          <p className="mt-0.5 text-xs text-ink-base/65">
            One topic → one draft → into the review queue. Nothing publishes automatically.
          </p>
        </div>
        {!isGenerating ? (
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setError(null);
              setSuccess(null);
            }}
            className="shrink-0 text-xs text-ink-base/60 underline underline-offset-2 hover:text-ink-strong"
          >
            Close
          </button>
        ) : null}
      </div>

      <div className="mt-4">
        <label
          htmlFor="new-draft-topic"
          className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-base/55"
        >
          Topic
        </label>
        <input
          id="new-draft-topic"
          ref={inputRef}
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isGenerating}
          maxLength={TOPIC_MAX}
          placeholder="e.g. How to choose the right swaddle size for a newborn"
          className="mt-1.5 w-full rounded-2xl border border-ink-base/14 bg-surface-raised px-4 py-2.5 text-sm text-ink-strong placeholder:text-ink-base/40 focus:border-ink-walnut/40 focus:outline-none disabled:opacity-60"
        />
        <div className="mt-1.5 flex items-center justify-between text-[11px] text-ink-base/50">
          <span>{tooShort ? `At least ${TOPIC_MIN} characters.` : "A single, specific parent question works best."}</span>
          <span className="tabular-nums">
            {trimmed.length}/{TOPIC_MAX}
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!canSubmit}
          className="rounded-full bg-ink-walnut px-5 py-2 text-sm font-medium text-ink-foreground transition-opacity hover:bg-ink-espresso disabled:opacity-50"
        >
          {isGenerating ? "Generating…" : "Generate draft"}
        </button>
        {isGenerating ? (
          <span className="inline-flex items-center gap-2 text-xs text-ink-base/70">
            <span
              aria-hidden
              className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink-base/25 border-t-ink-walnut"
            />
            {PROGRESS_PHASES[phase]}
          </span>
        ) : null}
      </div>

      {isGenerating ? (
        <p className="mt-3 text-[11px] text-ink-base/50">
          This takes 30–60 seconds — drafting plus an Opus critique pass. Keep this tab open.
        </p>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-2xl border border-tone-danger/25 bg-emphasis-berry-tint p-3.5 text-xs text-tone-danger">
          <p className="font-medium">Couldn’t generate this draft</p>
          <p className="mt-1 leading-relaxed">{error}</p>
        </div>
      ) : null}

      {success ? (
        <div className="mt-4 rounded-2xl border border-tone-green/25 bg-tone-green-tint p-3.5 text-xs text-tone-green-deep">
          <p className="font-medium">Draft created — opening it for review…</p>
          <p className="mt-1 leading-relaxed">“{success.title}” is now pending review in the queue.</p>
        </div>
      ) : null}
    </div>
  );
}
