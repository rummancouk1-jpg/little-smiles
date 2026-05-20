// Operator-facing draft creation form. One textarea for the topic, a
// handful of example chips to give a sense of what the AI handles well,
// and a generate button that surfaces a calm loading state during the
// 15-30 second wait while Sonnet writes the article.
//
// Success: route the operator straight into the draft's review page so
// they read what they just made. Error: surface the API's message
// inline — the lib/contentops/draft-generation errors are already
// operator-readable.

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type DraftCreateFormProps = {
  generateHref: string;
};

const TOPIC_MIN = 5;
const TOPIC_MAX = 200;

const TOPIC_EXAMPLES: string[] = [
  "Best swaddle fabrics for Pakistani summers",
  "How to choose newborn bodysuits for hot, humid weather",
  "Setting up a feeding routine in the first three months",
  "Premium baby bag essentials for short trips around the city",
];

export function DraftCreateForm({ generateHref }: DraftCreateFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [topic, setTopic] = useState("");
  const [error, setError] = useState<string | null>(null);

  const trimmed = topic.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < TOPIC_MIN;
  const tooLong = trimmed.length > TOPIC_MAX;
  const canSubmit = trimmed.length >= TOPIC_MIN && trimmed.length <= TOPIC_MAX && !isPending;

  const handleSubmit = () => {
    if (!canSubmit) return;
    setError(null);
    startTransition(async () => {
      let response: Response;
      try {
        response = await fetch(generateHref, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic: trimmed }),
        });
      } catch {
        setError(
          "Network problem during generation. If you waited the full minute, check the queue — the draft may have landed anyway.",
        );
        return;
      }

      const data = (await response.json().catch(() => null)) as
        | { ok: true; draft: { id: string; slug: string; title: string } }
        | { ok: false; error: string }
        | null;

      if (!response.ok || !data || data.ok !== true) {
        setError(
          (data && "error" in data && data.error) ||
            "Generation failed. Try a slightly different topic.",
        );
        return;
      }

      router.push(`/admin/contentops/${data.draft.id}`);
    });
  };

  return (
    <article className="rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-7 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-9">
      <div>
        <label
          htmlFor="topic"
          className="text-xs font-medium uppercase tracking-[0.16em] text-[#3B2F2F]/55"
        >
          Topic
        </label>
        <p className="mt-1 text-sm text-[#3B2F2F]/72">
          Describe what a parent might be searching for. The AI writes a calm,
          practical first draft you can review.
        </p>
        <textarea
          id="topic"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          maxLength={TOPIC_MAX}
          rows={3}
          disabled={isPending}
          placeholder="e.g. How to keep a newborn comfortable in summer heat"
          className="mt-3 w-full rounded-2xl border border-[#3B2F2F]/12 bg-white p-3 text-base text-[#1F1918] focus:border-[#2F2624]/40 focus:outline-none disabled:opacity-60"
        />
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-[#3B2F2F]/55">
          <span>
            {tooShort ? `${TOPIC_MIN - trimmed.length} more characters needed` : null}
            {tooLong ? "Topic is too long" : null}
          </span>
          <span>
            {trimmed.length}/{TOPIC_MAX}
          </span>
        </div>
      </div>

      <div className="mt-6">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#3B2F2F]/55">
          Try one of these
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {TOPIC_EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => {
                setTopic(example);
                setError(null);
              }}
              disabled={isPending}
              className="rounded-full border border-[#3B2F2F]/14 bg-white/75 px-3.5 py-1.5 text-xs text-[#2E2323] hover:border-[#3B2F2F]/24 hover:bg-[#F2EAE4] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {example}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-7 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          aria-busy={isPending}
          className="rounded-full bg-[#2F2624] px-5 py-2.5 text-sm font-medium text-[#F6F1EC] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isPending ? "Writing your draft…" : "Generate draft"}
        </button>
        <p className="text-xs text-[#3B2F2F]/60">
          {isPending
            ? "This usually takes 15–30 seconds. Don't refresh — we'll send you straight to the draft."
            : "Nothing is published. You review the AI's draft and decide whether to approve or decline."}
        </p>
      </div>

      {error ? (
        <p className="mt-4 rounded-2xl border border-[#8A2F40]/20 bg-[#FBEEF1] p-3 text-xs text-[#5E1C29]">
          {error}
        </p>
      ) : null}
    </article>
  );
}
