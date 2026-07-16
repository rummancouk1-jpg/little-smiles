// Engine component — client-side "New draft" generator for the queue.
// Sends a topic to the server route, which runs the SAME drafting pipeline
// the CLI runs (raised-floor prompt → Zod → duplicate guard → Opus critique →
// insert). API keys stay server-side; this component only knows the endpoint.

"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import type { TopicProvenance } from "@/lib/contentops/topic-provenance";

const TOPIC_MIN = 5;
const TOPIC_MAX = 200;
const VISIBILITY_GAP = "visibility_gap";

type TopicSuggestion = {
  keyword: string;
  question: string;
  priority: "high" | "medium" | "low";
  intent: string;
  /** Phase 3: present for AI-search visibility gaps — labels the chip + threads provenance to the draft. */
  source?: string | null;
  provenance?: TopicProvenance | null;
};

type SuggestionsResponse =
  | { ok: true; suggestions: TopicSuggestion[]; rankingNote: string; disclosure: string }
  | { ok: false; error: string };

function priorityDotClass(priority: TopicSuggestion["priority"]): string {
  const tone =
    priority === "high" ? "bg-tone-danger" : priority === "medium" ? "bg-tone-amber" : "bg-tone-blue";
  return `size-1.5 shrink-0 rounded-full ${tone}`;
}

// Cycled while the request is in flight so the operator sees forward motion
// during the ~30-60s generation (draft + Opus critique). Cosmetic only — the
// server does the real work and the final result is authoritative.
const PROGRESS_PHASES = [
  "Checking the corpus for overlap…",
  "Drafting the post (900–1100 words, FAQ, links)…",
  "Validating structure and internal links…",
  "Expanding to full length if needed…",
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
  /** Optional GET endpoint returning uncovered topic suggestions. When set, the
   *  form fetches it once on open and offers click-to-fill suggestion chips. */
  suggestionsHref?: string;
};

export function NewDraftForm({ generateHref, detailBaseHref, suggestionsHref }: NewDraftFormProps) {
  const detailHref = (id: string) => `${detailBaseHref}/${id}`;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [phase, setPhase] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ title: string; id: string } | null>(null);
  // Provenance of the currently-filled topic — set when a gap chip is clicked, cleared when the operator types
  // their own topic. Forwarded to generation so a gap-sourced draft stays labelled through to the review queue.
  const [pendingProvenance, setPendingProvenance] = useState<TopicProvenance | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Topic suggestions — fetched once on open (they're derived + stable). Additive:
  // any failure just hides the panel; the operator can always type a topic.
  const [suggestions, setSuggestions] = useState<TopicSuggestion[]>([]);
  const [suggestState, setSuggestState] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [suggestNote, setSuggestNote] = useState<{ ranking: string; disclosure: string }>({ ranking: "", disclosure: "" });
  const suggestionsRequested = useRef(false);

  const loadSuggestions = useCallback(async () => {
    if (!suggestionsHref || suggestionsRequested.current) return;
    suggestionsRequested.current = true;
    setSuggestState("loading");
    try {
      const res = await fetch(suggestionsHref);
      const data = (await res.json().catch(() => null)) as SuggestionsResponse | null;
      if (res.ok && data && data.ok) {
        setSuggestions(data.suggestions);
        setSuggestNote({ ranking: data.rankingNote, disclosure: data.disclosure });
        setSuggestState("loaded");
      } else {
        setSuggestState("error");
      }
    } catch {
      setSuggestState("error");
    }
  }, [suggestionsHref]);

  // Click-to-fill: put the suggested parent question in the topic box, but do NOT
  // generate — the operator edits if desired and hits Generate themselves. Captures
  // the suggestion's provenance (if any) so a gap-sourced draft stays labelled.
  const fillTopic = (s: TopicSuggestion) => {
    setTopic(s.question.slice(0, TOPIC_MAX));
    setPendingProvenance(s.provenance ?? null);
    setError(null);
    setSuccess(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

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
    void loadSuggestions(); // lazy — only when the operator intends to create a draft
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
        // Phase 3: forward provenance when this topic came from a visibility-gap chip, so the draft is labelled.
        body: JSON.stringify({ topic: trimmed, provenance: pendingProvenance ?? undefined }),
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
      setPendingProvenance(null);
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
          onChange={(e) => {
            setTopic(e.target.value);
            setPendingProvenance(null); // a hand-typed topic is not gap-sourced
          }}
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

      {/* Topic suggestions — uncovered gaps from local site data. Click to fill the
          box (never auto-generate). Honest by construction: not search-volume-ranked. */}
      {suggestionsHref ? (
        <div className="mt-4 rounded-2xl border border-ink-base/10 bg-surface-raised/40 p-3.5">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-base/55">
            Suggested gaps to cover
          </p>
          {suggestState === "loading" ? (
            <p className="mt-2 text-xs text-ink-base/50">Finding uncovered topics…</p>
          ) : null}
          {suggestState === "error" ? (
            <p className="mt-2 text-xs text-ink-base/50">
              Suggestions unavailable right now — type a topic above.
            </p>
          ) : null}
          {suggestState === "loaded" && suggestions.length === 0 ? (
            <p className="mt-2 text-xs text-ink-base/50">
              No uncovered gaps surfaced — the local opportunities are all covered. Type a topic above.
            </p>
          ) : null}
          {suggestState === "loaded" && suggestions.length > 0 ? (
            <>
              <ul className="mt-2 grid gap-2">
                {suggestions.map((s) => (
                  <li key={s.keyword}>
                    <button
                      type="button"
                      onClick={() => fillTopic(s)}
                      disabled={isGenerating}
                      className="w-full rounded-xl border border-ink-base/12 bg-surface-card/80 px-3.5 py-2.5 text-left transition-colors hover:border-ink-walnut/40 hover:bg-surface-hover disabled:opacity-50"
                      title="Fill the topic box with this question — you can edit it before generating"
                    >
                      <span className="flex items-center gap-2">
                        <span aria-hidden className={priorityDotClass(s.priority)} />
                        <span className="text-sm text-ink-strong">{s.question}</span>
                      </span>
                      {s.source === VISIBILITY_GAP && s.provenance ? (
                        <span className="mt-1 block pl-4 text-[11px] text-tone-danger">
                          <span className="rounded-full bg-emphasis-berry-tint px-1.5 py-0.5 font-medium">AI-search gap</span>
                          <span className="ml-1.5 text-ink-base/70">
                            invisible {s.provenance.visibilityStreak} scan{s.provenance.visibilityStreak === 1 ? "" : "s"} running
                            {s.provenance.competitorsCited.length > 0
                              ? ` · cited instead: ${s.provenance.competitorsCited.slice(0, 3).join(", ")}`
                              : ""}
                          </span>
                        </span>
                      ) : (
                        <span className="mt-0.5 block pl-4 font-mono text-[11px] text-ink-base/55">
                          {s.keyword} · {s.intent.replace(/_/g, " ")}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
              <p className="mt-2.5 text-[11px] leading-relaxed text-ink-base/50">
                {suggestNote.ranking}
                {suggestNote.disclosure ? (
                  <span className="mt-0.5 block">{suggestNote.disclosure}</span>
                ) : null}
              </p>
            </>
          ) : null}
        </div>
      ) : null}

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
          This takes ~30–90 seconds — drafting, a full-length expansion pass if the draft comes out
          thin, then an Opus critique. Keep this tab open.
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
