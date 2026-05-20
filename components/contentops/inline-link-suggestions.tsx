// Operator-facing card listing inline-link suggestions for the article.
// Calm editorial framing — these are ideas, not mandates. The operator
// uses them during refinement; nothing is auto-applied.
//
// Card stays hidden when no suggestions exist so a quiet editorial
// graph reads as a quiet card, not a deficiency to highlight.

import Link from "next/link";

import type { InlineLinkSuggestion } from "@/lib/contentops/intelligence/relationships";

type Props = {
  suggestions: InlineLinkSuggestion[];
};

export function InlineLinkSuggestions({ suggestions }: Props) {
  if (suggestions.length === 0) return null;

  return (
    <article className="rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-5 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#3B2F2F]/55">
            Inline link suggestions
          </p>
          <p className="mt-1 text-sm text-[#3B2F2F]/72">
            Phrases inside your article that could become editorial links.
            Edit to keep the rhythm natural — ignore anything that doesn&rsquo;t fit.
          </p>
        </div>
      </div>
      <ul className="mt-4 space-y-3">
        {suggestions.map((s, i) => (
          <li
            key={`${s.kind}-${s.destinationSlug}-${i}`}
            className="rounded-2xl border border-[#3B2F2F]/10 bg-[#FBF7F3] p-4"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm text-[#1F1918]">
                <span className="font-medium">&ldquo;{s.anchor}&rdquo;</span>{" "}
                <span className="text-xs text-[#3B2F2F]/55">
                  · Section {s.sectionIndex + 1}
                </span>
              </p>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] ${
                  s.kind === "article"
                    ? "bg-[#D7E4EE] text-[#1E3F5A]"
                    : "bg-[#EFE7DE] text-[#3B2F2F]/72"
                }`}
              >
                {s.kind === "article" ? "Article" : "Product"}
              </span>
            </div>
            <p className="mt-1 text-xs text-[#3B2F2F]/72">
              Link to{" "}
              <Link
                href={
                  s.kind === "article"
                    ? `/blog/${s.destinationSlug}`
                    : `/shop/${s.destinationSlug}`
                }
                target="_blank"
                className="font-medium text-[#2E2323] underline underline-offset-2 hover:text-[#1F1918]"
              >
                {s.destinationTitle}
              </Link>
            </p>
            <p className="mt-1 text-[11px] italic text-[#3B2F2F]/55">{s.reason}</p>
          </li>
        ))}
      </ul>
    </article>
  );
}
