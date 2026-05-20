// Calm editorial edit form. One page, one save action. Typography-first
// layout — no toolbars, no rich-text widgets, no block editor chrome.
// The operator works in textareas and selects that match the article's
// natural shape; on save, the client maps the form state into the
// canonical BlogPost partial shape and PATCHes the draft endpoint.
//
// Schema integrity: every save is validated server-side against
// blogPostSchema. Empty sections (no heading + no paragraphs after
// splitting on blank lines) are dropped client-side; the engine
// rejects payloads that would leave the article without sections.
//
// Slug stays read-only — changing it breaks URL semantics and the
// active-slug uniqueness invariant. The form shows it for context but
// disables editing.

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import { formatAbsolute } from "@/components/contentops/relative-time";
import {
  blogCategorySchema,
  blogRelatedProductCategorySchema,
  type BlogCategory,
  type BlogPost,
  type BlogRelatedProductCategory,
} from "@/lib/contentops/blog-schema";
import type { DraftStatus } from "@/lib/contentops/drafts-store";

type DraftEditFormProps = {
  draftId: string;
  initial: BlogPost;
  draftStatus: DraftStatus;
  scheduledAt: string | null;
};

type EditableSection = {
  heading: string;
  body: string; // paragraphs joined by blank lines for the textarea
};

type FormState = {
  title: string;
  description: string;
  category: BlogCategory;
  relatedProductCategory: BlogRelatedProductCategory;
  publishedAt: string;
  readTime: string;
  keywords: string; // comma-separated for the input
  sections: EditableSection[];
  ctaLabel: string;
  ctaHref: string;
};

const CATEGORY_OPTIONS = blogCategorySchema.options;
const RELATED_CATEGORY_OPTIONS = blogRelatedProductCategorySchema.options;

function initialState(initial: BlogPost): FormState {
  return {
    title: initial.title,
    description: initial.description,
    category: initial.category,
    relatedProductCategory: initial.relatedProductCategory,
    publishedAt: initial.publishedAt,
    readTime: initial.readTime,
    keywords: initial.keywords.join(", "),
    sections: initial.sections.map((s) => ({
      heading: s.heading,
      body: s.content.join("\n\n"),
    })),
    ctaLabel: initial.cta.label,
    ctaHref: initial.cta.href,
  };
}

function splitKeywords(input: string): string[] {
  return input
    .split(/[,\n]/)
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
}

function parseSectionBody(body: string): string[] {
  return body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

export function DraftEditForm({
  draftId,
  initial,
  draftStatus,
  scheduledAt,
}: DraftEditFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<FormState>(() => initialState(initial));
  const [error, setError] = useState<string | null>(null);

  // Commit Z: unsaved-changes guard. Compare normalized JSON of the
  // initial snapshot and the current form state. While dirty, attach a
  // beforeunload handler so the browser warns the operator before they
  // close the tab or navigate away. Save success clears the dirty
  // state implicitly by router-pushing away.
  const initialJson = useMemo(
    () => JSON.stringify(initialState(initial)),
    [initial],
  );
  const isDirty = useMemo(() => JSON.stringify(state) !== initialJson, [
    state,
    initialJson,
  ]);

  useEffect(() => {
    if (!isDirty || isPending) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Modern browsers ignore the message text but require returnValue
      // to be set for the dialog to surface.
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty, isPending]);

  const isScheduled = draftStatus === "scheduled";

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
  };

  const setSection = <K extends keyof EditableSection>(
    index: number,
    key: K,
    value: EditableSection[K],
  ) => {
    setState((prev) => ({
      ...prev,
      sections: prev.sections.map((s, i) =>
        i === index ? { ...s, [key]: value } : s,
      ),
    }));
  };

  const addSection = () => {
    setState((prev) => ({
      ...prev,
      sections: [...prev.sections, { heading: "", body: "" }],
    }));
  };

  const removeSection = (index: number) => {
    setState((prev) => ({
      ...prev,
      sections: prev.sections.filter((_, i) => i !== index),
    }));
  };

  const moveSection = (index: number, direction: -1 | 1) => {
    setState((prev) => {
      const next = [...prev.sections];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...prev, sections: next };
    });
  };

  const handleSubmit = () => {
    setError(null);
    // Client-side normalization
    const title = state.title.trim();
    const description = state.description.trim();
    const readTime = state.readTime.trim();
    const publishedAt = state.publishedAt.trim();
    const keywords = splitKeywords(state.keywords);
    const ctaLabel = state.ctaLabel.trim();
    const ctaHref = state.ctaHref.trim();
    const sections = state.sections
      .map((s) => ({
        heading: s.heading.trim(),
        content: parseSectionBody(s.body),
      }))
      .filter((s) => s.heading.length > 0 && s.content.length > 0);

    if (title.length === 0) {
      setError("Title can't be empty.");
      return;
    }
    if (description.length === 0) {
      setError("Description can't be empty.");
      return;
    }
    if (publishedAt.length === 0) {
      setError("Publish date can't be empty.");
      return;
    }
    if (readTime.length === 0) {
      setError("Read time can't be empty.");
      return;
    }
    if (sections.length === 0) {
      setError("At least one section is required.");
      return;
    }
    if (ctaLabel.length === 0) {
      setError("Call-to-action label can't be empty.");
      return;
    }
    if (ctaHref.length === 0) {
      setError("Call-to-action link can't be empty.");
      return;
    }

    const payload = {
      content: {
        title,
        description,
        category: state.category,
        relatedProductCategory: state.relatedProductCategory,
        publishedAt,
        readTime,
        keywords,
        sections,
        cta: { label: ctaLabel, href: ctaHref },
      },
    };

    startTransition(async () => {
      let response: Response;
      try {
        response = await fetch(`/api/admin/contentops/drafts/${draftId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch {
        setError("Network problem. Try again.");
        return;
      }
      const data = (await response.json().catch(() => null)) as
        | { ok: true; draft: unknown }
        | { ok: false; error: string }
        | null;
      if (!response.ok || !data || data.ok !== true) {
        setError((data && "error" in data && data.error) || "Failed to save edits.");
        return;
      }
      router.push(`/admin/contentops/${draftId}`);
    });
  };

  const inputClass =
    "w-full rounded-xl border border-[#3B2F2F]/12 bg-white px-3 py-2 text-sm text-[#1F1918] focus:border-[#2F2624]/40 focus:outline-none disabled:opacity-60";
  const textareaClass =
    "w-full rounded-2xl border border-[#3B2F2F]/12 bg-white p-3 text-sm leading-relaxed text-[#1F1918] focus:border-[#2F2624]/40 focus:outline-none disabled:opacity-60";
  const labelClass =
    "text-xs font-medium uppercase tracking-[0.12em] text-[#3B2F2F]/55";

  return (
    <article className="rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-7 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-9">
      <div className="space-y-7">
        {isScheduled ? (
          <div className="rounded-2xl border border-[#2F4F6A]/25 bg-[#EAF1F7] p-4 text-sm leading-relaxed text-[#1E3F5A]">
            <p className="font-medium">
              This article is scheduled to publish
              {scheduledAt ? ` on ${formatAbsolute(scheduledAt)}` : ""}.
            </p>
            <p className="mt-1 text-xs text-[#1E3F5A]/85">
              Your edits update the scheduled version. The publish time
              isn&rsquo;t changed — reschedule from the publishing surface if
              you need a different moment.
            </p>
          </div>
        ) : null}

        {/* Title + Description */}
        <div>
          <label htmlFor="edit-title" className={labelClass}>Title</label>
          <input
            id="edit-title"
            type="text"
            value={state.title}
            onChange={(e) => setField("title", e.target.value)}
            disabled={isPending}
            className={`mt-2 ${inputClass}`}
          />
        </div>

        <div>
          <label htmlFor="edit-description" className={labelClass}>Description</label>
          <textarea
            id="edit-description"
            value={state.description}
            onChange={(e) => setField("description", e.target.value)}
            rows={3}
            disabled={isPending}
            className={`mt-2 ${textareaClass}`}
          />
          <p className="mt-1 text-xs text-[#3B2F2F]/55">
            One sentence that explains the article. Shown on cards and in search results.
          </p>
        </div>

        {/* URL path — read-only */}
        <div>
          <p className={labelClass}>URL path</p>
          <p className="mt-2 rounded-xl border border-[#3B2F2F]/10 bg-[#FBF7F3] px-3 py-2 font-mono text-sm text-[#3B2F2F]/72">
            /blog/{initial.slug}
          </p>
          <p className="mt-1 text-xs text-[#3B2F2F]/55">
            The URL is fixed once a draft exists. Generate a new draft if the slug
            needs to change.
          </p>
        </div>

        {/* Category + Related category */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="edit-category" className={labelClass}>Category</label>
            <select
              id="edit-category"
              value={state.category}
              onChange={(e) => setField("category", e.target.value as BlogCategory)}
              disabled={isPending}
              className={`mt-2 ${inputClass}`}
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="edit-related-category" className={labelClass}>
              Anchored to
            </label>
            <select
              id="edit-related-category"
              value={state.relatedProductCategory}
              onChange={(e) =>
                setField(
                  "relatedProductCategory",
                  e.target.value as BlogRelatedProductCategory,
                )
              }
              disabled={isPending}
              className={`mt-2 ${inputClass}`}
            >
              {RELATED_CATEGORY_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Publish date + read time */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="edit-published-at" className={labelClass}>Publish date</label>
            <input
              id="edit-published-at"
              type="text"
              value={state.publishedAt}
              onChange={(e) => setField("publishedAt", e.target.value)}
              disabled={isPending}
              placeholder="YYYY-MM-DD"
              className={`mt-2 ${inputClass}`}
            />
          </div>
          <div>
            <label htmlFor="edit-read-time" className={labelClass}>Read time</label>
            <input
              id="edit-read-time"
              type="text"
              value={state.readTime}
              onChange={(e) => setField("readTime", e.target.value)}
              disabled={isPending}
              placeholder="6 min read"
              className={`mt-2 ${inputClass}`}
            />
          </div>
        </div>

        {/* Keywords */}
        <div>
          <label htmlFor="edit-keywords" className={labelClass}>Keywords</label>
          <input
            id="edit-keywords"
            type="text"
            value={state.keywords}
            onChange={(e) => setField("keywords", e.target.value)}
            disabled={isPending}
            placeholder="separate, with, commas"
            className={`mt-2 ${inputClass}`}
          />
          <p className="mt-1 text-xs text-[#3B2F2F]/55">
            Search signals. Three to seven phrases is plenty.
          </p>
        </div>

        {/* Sections */}
        <div>
          <p className={labelClass}>Sections</p>
          <p className="mt-1 text-xs text-[#3B2F2F]/55">
            Separate paragraphs with a blank line. Empty sections are dropped on save.
          </p>
          <div className="mt-4 space-y-5">
            {state.sections.map((section, index) => (
              <div
                key={index}
                className="rounded-2xl border border-[#3B2F2F]/10 bg-[#FBF7F3] p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs uppercase tracking-[0.12em] text-[#3B2F2F]/55">
                    Section {index + 1}
                  </p>
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <button
                      type="button"
                      onClick={() => moveSection(index, -1)}
                      disabled={isPending || index === 0}
                      className="text-[#3B2F2F]/65 underline underline-offset-2 hover:text-[#3B2F2F] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Move up
                    </button>
                    <button
                      type="button"
                      onClick={() => moveSection(index, 1)}
                      disabled={isPending || index === state.sections.length - 1}
                      className="text-[#3B2F2F]/65 underline underline-offset-2 hover:text-[#3B2F2F] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Move down
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSection(index)}
                      disabled={isPending}
                      className="text-[#6A3E31] underline underline-offset-2 hover:text-[#5B342B] disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <div className="mt-3">
                  <label
                    htmlFor={`section-heading-${index}`}
                    className={labelClass}
                  >
                    Heading
                  </label>
                  <input
                    id={`section-heading-${index}`}
                    type="text"
                    value={section.heading}
                    onChange={(e) => setSection(index, "heading", e.target.value)}
                    disabled={isPending}
                    className={`mt-2 ${inputClass}`}
                  />
                </div>

                <div className="mt-3">
                  <label
                    htmlFor={`section-body-${index}`}
                    className={labelClass}
                  >
                    Paragraphs
                  </label>
                  <textarea
                    id={`section-body-${index}`}
                    value={section.body}
                    onChange={(e) => setSection(index, "body", e.target.value)}
                    rows={6}
                    disabled={isPending}
                    className={`mt-2 ${textareaClass}`}
                  />
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addSection}
            disabled={isPending}
            className="mt-4 rounded-full border border-[#3B2F2F]/14 bg-white px-4 py-2 text-sm font-medium text-[#2E2323] hover:bg-[#F2EAE4] disabled:cursor-not-allowed disabled:opacity-40"
          >
            + Add section
          </button>
        </div>

        {/* CTA */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="edit-cta-label" className={labelClass}>CTA label</label>
            <input
              id="edit-cta-label"
              type="text"
              value={state.ctaLabel}
              onChange={(e) => setField("ctaLabel", e.target.value)}
              disabled={isPending}
              placeholder="Shop newborn essentials"
              className={`mt-2 ${inputClass}`}
            />
          </div>
          <div>
            <label htmlFor="edit-cta-href" className={labelClass}>CTA link</label>
            <input
              id="edit-cta-href"
              type="text"
              value={state.ctaHref}
              onChange={(e) => setField("ctaHref", e.target.value)}
              disabled={isPending}
              placeholder="/shop?category=Bodysuits"
              className={`mt-2 ${inputClass}`}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3 border-t border-[#3B2F2F]/10 pt-6">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            aria-busy={isPending}
            className="rounded-full bg-[#2F2624] px-5 py-2.5 text-sm font-medium text-[#F6F1EC] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isPending ? "Saving…" : "Save changes"}
          </button>
          <button
            type="button"
            onClick={() => {
              if (
                isDirty &&
                typeof window !== "undefined" &&
                !window.confirm(
                  "You have unsaved changes. Leave anyway?",
                )
              ) {
                return;
              }
              router.push(`/admin/contentops/${draftId}`);
            }}
            disabled={isPending}
            className="text-xs text-[#3B2F2F]/65 underline underline-offset-2 hover:text-[#3B2F2F] disabled:opacity-50"
          >
            Cancel
          </button>
          <p className="ml-auto text-xs text-[#3B2F2F]/60">
            Edits are saved as a single revision. The article stays in its current
            status — nothing is published.
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
