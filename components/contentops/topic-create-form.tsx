// Operator-facing form for adding a topic to the editorial queue. Calm
// fields, no SEO terminology beyond what's essential: title, intent,
// related category (optional), priority, seasonality, optional notes.
// Future intelligence layers will populate competition/trend/window
// automatically; the operator doesn't need to think about those here.

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type {
  TopicIntent,
  TopicPriority,
  TopicSeasonality,
} from "@/lib/contentops/topics-store";

type TopicCreateFormProps = {
  createHref: string;
  relatedCategoryOptions: string[];
};

const TITLE_MIN = 5;
const TITLE_MAX = 200;

const INTENT_OPTIONS: { value: TopicIntent; label: string; helper: string }[] = [
  {
    value: "informational",
    label: "Informational",
    helper: "Answers a parent question or explains a topic.",
  },
  {
    value: "commercial",
    label: "Commercial",
    helper: "Comparing / choosing / recommending products.",
  },
  {
    value: "transactional",
    label: "Transactional",
    helper: "Driven by purchase intent (rare for this brand).",
  },
];

const PRIORITY_OPTIONS: { value: TopicPriority; label: string }[] = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const SEASONALITY_OPTIONS: { value: TopicSeasonality; label: string }[] = [
  { value: "evergreen", label: "Year-round" },
  { value: "summer", label: "Summer" },
  { value: "winter", label: "Winter" },
  { value: "monsoon", label: "Monsoon" },
  { value: "eid", label: "Eid season" },
];

export function TopicCreateForm({
  createHref,
  relatedCategoryOptions,
}: TopicCreateFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [intent, setIntent] = useState<TopicIntent>("informational");
  const [relatedCategory, setRelatedCategory] = useState<string>("");
  const [priority, setPriority] = useState<TopicPriority>("medium");
  const [seasonality, setSeasonality] = useState<TopicSeasonality>("evergreen");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const trimmedTitle = title.trim();
  const canSubmit =
    trimmedTitle.length >= TITLE_MIN &&
    trimmedTitle.length <= TITLE_MAX &&
    !isPending;

  const submit = () => {
    if (!canSubmit) return;
    setError(null);
    const body = {
      title: trimmedTitle,
      intent,
      related_category: relatedCategory ? relatedCategory : null,
      priority,
      seasonality,
      notes: notes.trim() ? notes.trim() : null,
    };
    startTransition(async () => {
      let response: Response;
      try {
        response = await fetch(createHref, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } catch {
        setError("Network problem. Try again.");
        return;
      }
      const data = (await response.json().catch(() => null)) as
        | { ok: true; topic: { id: string } }
        | { ok: false; error: string }
        | null;
      if (!response.ok || !data || data.ok !== true) {
        setError(
          (data && "error" in data && data.error) ||
            "Failed to add topic.",
        );
        return;
      }
      router.push("/admin/contentops/topics");
    });
  };

  return (
    <article className="rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-7 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-9">
      <div className="space-y-6">
        <div>
          <label
            htmlFor="topic-title"
            className="text-xs font-medium uppercase tracking-[0.16em] text-[#3B2F2F]/55"
          >
            Topic
          </label>
          <p className="mt-1 text-sm text-[#3B2F2F]/72">
            The question or theme a parent might be searching for. The AI uses
            this as the topic when you generate a draft.
          </p>
          <textarea
            id="topic-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={TITLE_MAX}
            rows={2}
            disabled={isPending}
            placeholder="e.g. How to keep a newborn comfortable in summer heat"
            className="mt-3 w-full rounded-2xl border border-[#3B2F2F]/12 bg-white p-3 text-base text-[#1F1918] focus:border-[#2F2624]/40 focus:outline-none disabled:opacity-60"
          />
          <div className="mt-1 flex flex-wrap items-center justify-end gap-2 text-xs text-[#3B2F2F]/55">
            <span>
              {trimmedTitle.length}/{TITLE_MAX}
            </span>
          </div>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#3B2F2F]/55">
            Intent
          </p>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {INTENT_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={[
                  "cursor-pointer rounded-2xl border p-3 text-sm transition-colors",
                  intent === opt.value
                    ? "border-[#2F2624] bg-[#FBF7F3]"
                    : "border-[#3B2F2F]/10 bg-white hover:bg-[#FBF7F3]",
                ].join(" ")}
              >
                <input
                  type="radio"
                  name="intent"
                  value={opt.value}
                  checked={intent === opt.value}
                  onChange={() => setIntent(opt.value)}
                  disabled={isPending}
                  className="sr-only"
                />
                <span className="font-medium text-[#1F1918]">{opt.label}</span>
                <span className="mt-1 block text-xs text-[#3B2F2F]/65">
                  {opt.helper}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label
              htmlFor="topic-category"
              className="text-xs font-medium uppercase tracking-[0.16em] text-[#3B2F2F]/55"
            >
              Related product category
            </label>
            <select
              id="topic-category"
              value={relatedCategory}
              onChange={(e) => setRelatedCategory(e.target.value)}
              disabled={isPending}
              className="mt-2 w-full rounded-xl border border-[#3B2F2F]/12 bg-white px-3 py-2 text-sm text-[#1F1918] focus:border-[#2F2624]/40 focus:outline-none disabled:opacity-60"
            >
              <option value="">— None —</option>
              {relatedCategoryOptions.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="topic-seasonality"
              className="text-xs font-medium uppercase tracking-[0.16em] text-[#3B2F2F]/55"
            >
              Seasonality
            </label>
            <select
              id="topic-seasonality"
              value={seasonality}
              onChange={(e) => setSeasonality(e.target.value as TopicSeasonality)}
              disabled={isPending}
              className="mt-2 w-full rounded-xl border border-[#3B2F2F]/12 bg-white px-3 py-2 text-sm text-[#1F1918] focus:border-[#2F2624]/40 focus:outline-none disabled:opacity-60"
            >
              {SEASONALITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#3B2F2F]/55">
            Priority
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {PRIORITY_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={[
                  "cursor-pointer rounded-full border px-4 py-1.5 text-xs font-medium transition-colors",
                  priority === opt.value
                    ? "border-[#2F2624] bg-[#2F2624] text-[#F6F1EC]"
                    : "border-[#3B2F2F]/14 bg-white text-[#2E2323] hover:border-[#3B2F2F]/24 hover:bg-[#F2EAE4]",
                ].join(" ")}
              >
                <input
                  type="radio"
                  name="priority"
                  value={opt.value}
                  checked={priority === opt.value}
                  onChange={() => setPriority(opt.value)}
                  disabled={isPending}
                  className="sr-only"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label
            htmlFor="topic-notes"
            className="text-xs font-medium uppercase tracking-[0.16em] text-[#3B2F2F]/55"
          >
            Notes (optional)
          </label>
          <textarea
            id="topic-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={2000}
            rows={3}
            disabled={isPending}
            placeholder="Editorial reminders — angle, audience, anything the AI should keep in mind when generating."
            className="mt-2 w-full rounded-2xl border border-[#3B2F2F]/12 bg-white p-3 text-sm text-[#1F1918] focus:border-[#2F2624]/40 focus:outline-none disabled:opacity-60"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            aria-busy={isPending}
            className="rounded-full bg-[#2F2624] px-5 py-2.5 text-sm font-medium text-[#F6F1EC] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isPending ? "Adding…" : "Add to queue"}
          </button>
          <p className="text-xs text-[#3B2F2F]/60">
            Topics sit in the queue until you generate a draft. Nothing is
            published automatically.
          </p>
        </div>

        {error ? (
          <p className="rounded-2xl border border-[#8A2F40]/20 bg-[#FBEEF1] p-3 text-xs text-[#5E1C29]">
            {error}
          </p>
        ) : null}
      </div>
    </article>
  );
}
