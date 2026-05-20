// Read-only display of the deterministic image prompts attached to a
// draft. Operator copies each prompt into Midjourney / Imagen / Flux
// while Phase-2 provider integration is being built. Calm card chrome
// matching the rest of the editorial surfaces — no UI redesign.

"use client";

import { useState } from "react";

import type { BlogImagePrompts } from "@/lib/contentops/blog-schema";

// Slot id is the union of the prompt-bearing keys on BlogImagePrompts.
// Pinterest is optional in storage (older drafts predate it) so we
// surface it only when actually present below.
type SlotId = "hero" | "thumbnail" | "og" | "pinterest";

type Slot = { id: SlotId; label: string; helper: string };

const SLOTS: Slot[] = [
  { id: "hero", label: "Hero (16:9)", helper: "Full-width article banner." },
  { id: "thumbnail", label: "Thumbnail (1:1)", helper: "Cards and OG fallback." },
  { id: "og", label: "OG card (1200×630)", helper: "Social share preview." },
  { id: "pinterest", label: "Pinterest pin (2:3)", helper: "Vertical pin for Pinterest discovery." },
];

type Props = {
  prompts: BlogImagePrompts | undefined | null;
};

export function ImagePromptsCard({ prompts }: Props) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!prompts) {
    return (
      <article className="rounded-3xl border border-[#3B2F2F]/10 bg-[#FBF7F3] p-5 text-sm text-[#3B2F2F]/72 sm:p-6">
        <p className="font-medium text-[#1F1918]">Image prompts</p>
        <p className="mt-1 text-xs">
          This draft was generated before automatic image prompts were enabled.
          Generate a fresh draft on the same topic to receive prompt suggestions,
          or compose imagery by hand.
        </p>
      </article>
    );
  }

  const copy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((curr) => (curr === key ? null : curr)), 1500);
    } catch {
      // Clipboard API failures are quiet — the textarea is selectable.
    }
  };

  return (
    <article className="rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-5 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#3B2F2F]/55">
            Auto-generated image prompts
          </p>
          <p className="mt-1 text-sm text-[#3B2F2F]/72">
            Paste these into Midjourney, Imagen, or Flux. Edit before sending —
            they&rsquo;re a starting point, not a final brief.
          </p>
        </div>
        <span className="rounded-full border border-[#3B2F2F]/14 bg-[#EEE4DB] px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-[#3B2F2F]/72">
          {prompts.paletteVersion}
        </span>
      </div>
      <div className="mt-4 space-y-4">
        {SLOTS.map((slot) => {
          const value = prompts[slot.id];
          if (!value) return null;
          return (
            <div key={slot.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-medium text-[#1F1918]">{slot.label}</p>
                <button
                  type="button"
                  onClick={() => copy(slot.id, value)}
                  className="rounded-full border border-[#3B2F2F]/14 bg-white px-3 py-1 text-[11px] font-medium text-[#2E2323] hover:bg-[#F2EAE4]"
                >
                  {copiedKey === slot.id ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="mt-0.5 text-[11px] text-[#3B2F2F]/55">{slot.helper}</p>
              <textarea
                readOnly
                value={value}
                rows={4}
                className="mt-2 w-full resize-y rounded-xl border border-[#3B2F2F]/12 bg-[#FBF7F3] p-3 font-mono text-[12px] leading-relaxed text-[#1F1918] focus:border-[#2F2624]/40 focus:outline-none"
              />
            </div>
          );
        })}
      </div>
    </article>
  );
}
