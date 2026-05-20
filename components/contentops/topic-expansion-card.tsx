// Operator-facing topic expansion card. Surfaced on the article-review
// page for published drafts (and approved/scheduled where queuing the
// next round makes sense). Calm one-click action: preview, then queue.

"use client";

import { useState, useTransition } from "react";

type Suggestion = {
  title: string;
  format: string;
  intent: string;
  seasonality: string;
  cluster: string;
  rationale: string;
};

type ApiResponse =
  | {
      ok: true;
      suggestions: Suggestion[];
      created: Array<{ id: string; title: string }>;
      skipped: Array<{ title: string; reason: string }>;
    }
  | { ok: false; error: string };

type Props = {
  draftId: string;
};

export function TopicExpansionCard({ draftId }: Props) {
  const [, startTransition] = useTransition();
  const [phase, setPhase] = useState<"idle" | "previewing" | "queueing">("idle");
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [created, setCreated] = useState<Array<{ id: string; title: string }>>([]);
  const [skipped, setSkipped] = useState<Array<{ title: string; reason: string }>>([]);
  const [error, setError] = useState<string | null>(null);

  const run = (dryRun: boolean) => {
    setError(null);
    if (dryRun) {
      setSuggestions(null);
      setCreated([]);
      setSkipped([]);
    }
    setPhase(dryRun ? "previewing" : "queueing");
    startTransition(async () => {
      let response: Response;
      try {
        response = await fetch(`/api/admin/contentops/topics/expand`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ draftId, dryRun }),
        });
      } catch {
        setError("Network problem.");
        setPhase("idle");
        return;
      }
      const data = (await response.json().catch(() => null)) as ApiResponse | null;
      if (!data || !response.ok || data.ok !== true) {
        setError((data && "error" in data && data.error) || "Failed.");
        setPhase("idle");
        return;
      }
      setSuggestions(data.suggestions);
      setCreated(data.created);
      setSkipped(data.skipped);
      setPhase("idle");
    });
  };

  return (
    <article className="rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-5 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#3B2F2F]/55">
            Topical expansion
          </p>
          <p className="mt-1 text-sm text-[#3B2F2F]/72">
            Queue supporting articles that reinforce this article&rsquo;s cluster.
            Each suggestion respects the existing topic queue and skips
            duplicates automatically.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => run(true)}
            disabled={phase !== "idle"}
            className="rounded-full border border-[#3B2F2F]/14 bg-white px-4 py-2 text-sm font-medium text-[#2E2323] hover:bg-[#F2EAE4] disabled:opacity-50"
          >
            {phase === "previewing" ? "Previewing…" : "Preview suggestions"}
          </button>
          <button
            type="button"
            onClick={() => run(false)}
            disabled={phase !== "idle"}
            className="rounded-full bg-[#2F2624] px-4 py-2 text-sm font-medium text-[#F6F1EC] hover:opacity-90 disabled:opacity-40"
          >
            {phase === "queueing" ? "Queueing…" : "Queue all"}
          </button>
        </div>
      </div>

      {error ? (
        <p className="mt-3 rounded-2xl border border-[#8A2F40]/20 bg-[#FBEEF1] p-3 text-xs text-[#5E1C29]">
          {error}
        </p>
      ) : null}

      {created.length > 0 ? (
        <p className="mt-3 rounded-2xl border border-[#2E6A41]/20 bg-[#EAF5EE] p-3 text-xs text-[#1E5A37]">
          Queued {created.length} topic{created.length === 1 ? "" : "s"}.
          {skipped.length > 0
            ? ` Skipped ${skipped.length} (already in the queue or published).`
            : ""}
        </p>
      ) : null}

      {suggestions && suggestions.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {suggestions.map((s, i) => (
            <li
              key={`${s.title}-${i}`}
              className="rounded-2xl border border-[#3B2F2F]/10 bg-[#FBF7F3] p-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium text-[#1F1918]">{s.title}</p>
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-[0.12em]">
                  <span className="rounded-full bg-[#EFE7DE] px-2 py-0.5 text-[#3B2F2F]/72">
                    {s.format.replace(/_/g, " ")}
                  </span>
                  <span className="rounded-full bg-[#D7E4EE] px-2 py-0.5 text-[#1E3F5A]">
                    {s.cluster}
                  </span>
                </div>
              </div>
              <p className="mt-1 text-xs text-[#3B2F2F]/72">{s.rationale}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
