// Visual inspiration card. Renders the deterministic suggestions from
// the visual-style intelligence module as a calm checklist — framing
// cues, palette cues, preferred aspect, Pinterest fit. No reference
// images, no scraped thumbnails — pure editorial direction.

import type { VisualStyleSuggestion } from "@/lib/contentops/intelligence/visual-style-intelligence";

type Props = {
  suggestion: VisualStyleSuggestion;
};

export function VisualInspirationCard({ suggestion }: Props) {
  return (
    <article className="rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-5 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#3B2F2F]/55">
            Visual inspiration
          </p>
          <p className="mt-1 text-sm text-[#1F1918]">{suggestion.headline}</p>
        </div>
        <span className="rounded-full border border-[#3B2F2F]/14 bg-[#EEE4DB] px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-[#3B2F2F]/72">
          {suggestion.preferredAspect}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#3B2F2F]/55">
            Framing cues
          </p>
          <ul className="mt-2 space-y-1 text-sm text-[#1F1918]">
            {suggestion.framingCues.map((cue) => (
              <li
                key={cue}
                className="flex items-baseline gap-2 leading-relaxed"
              >
                <span aria-hidden className="text-[#3B2F2F]/50">·</span>
                {cue}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#3B2F2F]/55">
            Palette cues
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {suggestion.paletteCues.map((p) => (
              <li
                key={p}
                className="rounded-full bg-[#EFE7DE] px-2.5 py-1 text-[11px] text-[#3B2F2F]/80"
              >
                {p}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-[#3B2F2F]/55">
            Pinterest fit: {suggestion.pinterestSuitability}/100
          </p>
        </div>
      </div>
    </article>
  );
}
