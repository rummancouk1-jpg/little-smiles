// Media strategy card. Renders the media-strategy intelligence output
// as a calm checklist — one row per recommended asset, each with its
// current satisfaction status and rationale.

import type { MediaStrategy } from "@/lib/contentops/intelligence/media-strategy";

type Props = {
  strategy: MediaStrategy;
};

const STATUS_TONE = {
  satisfied: "bg-[#D7ECDD] text-[#1E5A37]",
  recommended: "bg-[#FBF3DD] text-[#5C4314]",
  optional: "bg-[#EFE7DE] text-[#3B2F2F]/72",
} as const;

const STATUS_LABEL = {
  satisfied: "Done",
  recommended: "Recommended",
  optional: "Optional",
} as const;

function slotLabel(slot: string, sectionIndex?: number): string {
  if (slot === "section" && typeof sectionIndex === "number") {
    return `Section ${sectionIndex + 1} image`;
  }
  switch (slot) {
    case "hero":
      return "Hero image";
    case "thumbnail":
      return "Thumbnail";
    case "og":
      return "OG social card";
    case "pinterest":
      return "Pinterest pin";
    default:
      return slot;
  }
}

export function MediaStrategyCard({ strategy }: Props) {
  return (
    <article className="rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-5 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-7">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#3B2F2F]/55">
        Media strategy
      </p>
      <p className="mt-1 text-sm text-[#3B2F2F]/72">
        Which visual assets matter most for this topic, in priority order.
      </p>
      <ul className="mt-4 space-y-2">
        {strategy.actions.map((action, i) => (
          <li
            key={`${action.slot}-${action.sectionIndex ?? ""}-${i}`}
            className="flex items-start gap-3 rounded-2xl border border-[#3B2F2F]/10 bg-[#FBF7F3] p-3"
          >
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] ${STATUS_TONE[action.status]}`}
            >
              {STATUS_LABEL[action.status]}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-[#1F1918]">
                {slotLabel(action.slot, action.sectionIndex)}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-[#3B2F2F]/72">
                {action.rationale}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </article>
  );
}
