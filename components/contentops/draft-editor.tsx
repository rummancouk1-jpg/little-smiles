// Engine component — in-place draft editing for reviewers. The fix for the
// reject-and-regenerate dead end: title/slug/meta/sections/CTA are all
// directly editable, with live SEO counters mirroring draft-validation
// thresholds so the reviewer can land inside the green band as they type.

"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import {
  blogCategorySchema,
  blogRelatedProductCategorySchema,
  type BlogPost,
} from "@/lib/contentops/blog-schema";

type DraftEditorProps = {
  draftId: string;
  initialContent: BlogPost;
  saveHref: string;
  backHref: string;
};

/** Mirror draft-validation thresholds so counters match the queue badges. */
const TITLE_MIN = 30;
const TITLE_MAX = 70;
const DESC_MIN = 80;
const DESC_MAX = 160;

type SectionForm = { heading: string; text: string };

function sectionsToForm(sections: BlogPost["sections"]): SectionForm[] {
  return sections.map((s) => ({ heading: s.heading, text: s.content.join("\n\n") }));
}

function formToSections(sections: SectionForm[]): BlogPost["sections"] {
  return sections.map((s) => ({
    heading: s.heading.trim(),
    content: s.text
      .split(/\n\s*\n/)
      .map((p) => p.replace(/\s+/g, " ").trim())
      .filter(Boolean),
  }));
}

function CharCounter({ value, min, max }: { value: number; min: number; max: number }) {
  const ok = value >= min && value <= max;
  return (
    <span
      className={
        ok ? "text-xs font-medium text-tone-green-deep" : "text-xs font-medium text-tone-danger"
      }
    >
      {value} chars {ok ? "✓" : `(target ${min}–${max})`}
    </span>
  );
}

const fieldClass =
  "w-full rounded-2xl border border-ink-base/14 bg-surface-raised p-3 text-sm text-ink-strong outline-none transition-[border-color] placeholder:text-ink-base/45 focus:border-ink-base/35";
const labelClass = "text-xs font-semibold uppercase tracking-[0.12em] text-ink-base/55";

export function DraftEditor({ draftId, initialContent, saveHref, backHref }: DraftEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState(initialContent.title);
  const [slug, setSlug] = useState(initialContent.slug);
  const [description, setDescription] = useState(initialContent.description);
  const [category, setCategory] = useState<BlogPost["category"]>(initialContent.category);
  const [relatedCategory, setRelatedCategory] = useState<BlogPost["relatedProductCategory"]>(
    initialContent.relatedProductCategory,
  );
  const [keywordsText, setKeywordsText] = useState(initialContent.keywords.join("\n"));
  const [sections, setSections] = useState<SectionForm[]>(
    sectionsToForm(initialContent.sections),
  );
  const [faq, setFaq] = useState<{ question: string; answer: string }[]>(
    initialContent.faq ?? [],
  );
  const [ctaLabel, setCtaLabel] = useState(initialContent.cta.label);
  const [ctaHref, setCtaHref] = useState(initialContent.cta.href);

  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  const wordCount = useMemo(
    () =>
      formToSections(sections).reduce(
        (sum, s) =>
          sum + s.content.reduce((n, p) => n + p.split(/\s+/).filter(Boolean).length, 0),
        0,
      ),
    [sections],
  );

  const updateSection = (index: number, patch: Partial<SectionForm>) => {
    setSections((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const handleSave = () => {
    setError(null);
    setDetails([]);
    setSaved(false);

    const content: BlogPost = {
      ...initialContent,
      slug: slug.trim(),
      title: title.trim(),
      description: description.trim(),
      category,
      relatedProductCategory: relatedCategory,
      keywords: keywordsText
        .split(/\n|,/)
        .map((k) => k.trim())
        .filter(Boolean),
      sections: formToSections(sections),
      cta: { label: ctaLabel.trim(), href: ctaHref.trim() },
    };
    const cleanFaq = faq
      .map((f) => ({ question: f.question.trim(), answer: f.answer.trim() }))
      .filter((f) => f.question.length > 0 && f.answer.length > 0);
    if (cleanFaq.length > 0) {
      content.faq = cleanFaq;
    } else {
      delete content.faq;
    }

    startTransition(async () => {
      const response = await fetch(saveHref, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = (await response.json().catch(() => null)) as
        | { ok: true; draft: unknown }
        | { ok: false; error: string; details?: string[] }
        | null;
      if (!response.ok || !data || data.ok !== true) {
        setError((data && "error" in data && data.error) || "Failed to save draft.");
        if (data && "details" in data && Array.isArray(data.details)) {
          setDetails(data.details);
        }
        return;
      }
      setSaved(true);
      router.refresh();
    });
  };

  return (
    <div
      className="space-y-6 rounded-3xl border border-ink-base/10 bg-surface-card/90 p-5 shadow-card-rest sm:p-7"
      data-draft-id={draftId}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <div className="flex items-baseline justify-between gap-3">
            <label className={labelClass} htmlFor="edit-title">
              Title
            </label>
            <CharCounter value={title.length} min={TITLE_MIN} max={TITLE_MAX} />
          </div>
          <input
            id="edit-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={fieldClass}
          />
        </div>

        <div className="space-y-1.5">
          <label className={labelClass} htmlFor="edit-slug">
            Slug
          </label>
          <input
            id="edit-slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
            className={`${fieldClass} font-mono`}
          />
          <p className="text-[11px] text-ink-base/55">
            Lives at /blog/{slug || "…"} — lowercase-hyphenated.
          </p>
        </div>

        <div className="space-y-1.5">
          <label className={labelClass} htmlFor="edit-category">
            Category
          </label>
          <select
            id="edit-category"
            value={category}
            onChange={(e) => setCategory(e.target.value as BlogPost["category"])}
            className={fieldClass}
          >
            {blogCategorySchema.options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <div className="flex items-baseline justify-between gap-3">
            <label className={labelClass} htmlFor="edit-description">
              Meta description
            </label>
            <CharCounter value={description.length} min={DESC_MIN} max={DESC_MAX} />
          </div>
          <textarea
            id="edit-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className={fieldClass}
          />
        </div>

        <div className="space-y-1.5">
          <label className={labelClass} htmlFor="edit-related">
            Related product category
          </label>
          <select
            id="edit-related"
            value={relatedCategory}
            onChange={(e) =>
              setRelatedCategory(e.target.value as BlogPost["relatedProductCategory"])
            }
            className={fieldClass}
          >
            {blogRelatedProductCategorySchema.options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-ink-base/55">
            Drives the hero-image fallback and the related-products block.
          </p>
        </div>

        <div className="space-y-1.5">
          <label className={labelClass} htmlFor="edit-keywords">
            Keywords (one per line)
          </label>
          <textarea
            id="edit-keywords"
            value={keywordsText}
            onChange={(e) => setKeywordsText(e.target.value)}
            rows={3}
            className={fieldClass}
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className={labelClass}>Sections</p>
          <span className="text-xs text-ink-base/60">{wordCount} words total</span>
        </div>
        {sections.map((section, index) => (
          <div
            key={index}
            className="space-y-2 rounded-2xl border border-ink-base/10 bg-surface-well p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <label className={labelClass} htmlFor={`edit-section-heading-${index}`}>
                Section {index + 1} heading
              </label>
              <button
                type="button"
                onClick={() => setSections((prev) => prev.filter((_, i) => i !== index))}
                disabled={sections.length <= 1 || isPending}
                className="text-xs font-medium text-tone-danger underline underline-offset-2 disabled:opacity-40"
              >
                Remove
              </button>
            </div>
            <input
              id={`edit-section-heading-${index}`}
              value={section.heading}
              onChange={(e) => updateSection(index, { heading: e.target.value })}
              className={fieldClass}
            />
            <label className="sr-only" htmlFor={`edit-section-body-${index}`}>
              Section {index + 1} body
            </label>
            <textarea
              id={`edit-section-body-${index}`}
              value={section.text}
              onChange={(e) => updateSection(index, { text: e.target.value })}
              rows={5}
              className={fieldClass}
              placeholder="Paragraphs separated by a blank line. Internal links: [soft swaddles](/shop?category=Swaddle)"
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() => setSections((prev) => [...prev, { heading: "", text: "" }])}
          disabled={isPending}
          className="rounded-full border border-ink-base/14 bg-surface-raised px-4 py-1.5 text-xs font-medium text-ink-walnut hover:bg-surface-hover disabled:opacity-50"
        >
          + Add section
        </button>
        <p className="text-[11px] text-ink-base/55">
          Link syntax: <code className="font-mono">[anchor text](/shop/slug)</code>,{" "}
          <code className="font-mono">[…](/blog/slug)</code>, or{" "}
          <code className="font-mono">[…](/shop?category=…)</code> — internal links only;
          anything else stays plain text.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className={labelClass}>FAQ (3–5 recommended)</p>
          <span className="text-xs text-ink-base/60">
            Renders on-page + emits FAQPage JSON-LD
          </span>
        </div>
        {faq.map((item, index) => (
          <div
            key={index}
            className="space-y-2 rounded-2xl border border-ink-base/10 bg-surface-well p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <label className={labelClass} htmlFor={`edit-faq-q-${index}`}>
                Question {index + 1}
              </label>
              <button
                type="button"
                onClick={() => setFaq((prev) => prev.filter((_, i) => i !== index))}
                disabled={isPending}
                className="text-xs font-medium text-tone-danger underline underline-offset-2"
              >
                Remove
              </button>
            </div>
            <input
              id={`edit-faq-q-${index}`}
              value={item.question}
              onChange={(e) =>
                setFaq((prev) =>
                  prev.map((f, i) => (i === index ? { ...f, question: e.target.value } : f)),
                )
              }
              className={fieldClass}
              placeholder="What age is a swaddle recommended for?"
            />
            <label className="sr-only" htmlFor={`edit-faq-a-${index}`}>
              Answer {index + 1}
            </label>
            <textarea
              id={`edit-faq-a-${index}`}
              value={item.answer}
              onChange={(e) =>
                setFaq((prev) =>
                  prev.map((f, i) => (i === index ? { ...f, answer: e.target.value } : f)),
                )
              }
              rows={2}
              className={fieldClass}
              placeholder="Short, direct answer (2–3 sentences). Link syntax works here too."
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() => setFaq((prev) => [...prev, { question: "", answer: "" }])}
          disabled={isPending}
          className="rounded-full border border-ink-base/14 bg-surface-raised px-4 py-1.5 text-xs font-medium text-ink-walnut hover:bg-surface-hover disabled:opacity-50"
        >
          + Add FAQ entry
        </button>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className={labelClass} htmlFor="edit-cta-label">
            CTA label
          </label>
          <input
            id="edit-cta-label"
            value={ctaLabel}
            onChange={(e) => setCtaLabel(e.target.value)}
            className={fieldClass}
          />
        </div>
        <div className="space-y-1.5">
          <label className={labelClass} htmlFor="edit-cta-href">
            CTA link
          </label>
          <input
            id="edit-cta-href"
            value={ctaHref}
            onChange={(e) => setCtaHref(e.target.value)}
            className={`${fieldClass} font-mono`}
            placeholder="/shop?category=Swaddle"
          />
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-tone-danger/25 bg-emphasis-berry-tint p-4">
          <p className="text-sm font-medium text-tone-danger">{error}</p>
          {details.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-tone-danger/85">
              {details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {saved ? (
        <p className="text-sm font-medium text-tone-green-deep">
          Saved. Validation badges refresh on the detail page.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 border-t border-ink-base/10 pt-5">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="rounded-full bg-ink-walnut px-6 py-2 text-sm font-medium text-ink-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save changes"}
        </button>
        <a href={backHref} className="text-xs text-ink-base/72 underline underline-offset-2">
          Back to draft review
        </a>
      </div>
    </div>
  );
}
