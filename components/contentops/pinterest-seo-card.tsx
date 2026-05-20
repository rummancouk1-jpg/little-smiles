// Pinterest SEO card. Shows the suggested Pinterest title +
// description (composed by the Pinterest intelligence layer) alongside
// a "Generate Pinterest pin" action that runs the generate route for
// the pinterest slot.
//
// Read-only display for the suggestions — the operator copies the
// title/description into Pinterest's UI directly. A future commit can
// add a save-to-draft action; until then we keep the surface read-only
// to match the rest of the media page.

"use client";

import { useState } from "react";

import { ImageGenerateButton } from "@/components/contentops/image-generate-button";
import { SafeImage } from "@/components/contentops/safe-image";
import type { BlogImage } from "@/lib/contentops/blog-schema";
import { resolveBlogImageSrc } from "@/lib/contentops/image-render";
import { validatePinterest } from "@/lib/contentops/intelligence/pinterest-validation";

type Props = {
  draftId: string;
  pinterestImage: BlogImage | null;
  suggestion: {
    title: string;
    description: string;
    suitabilityScore: number;
  };
  providerConfigured: boolean;
  /** True when the article is published (gates the action). */
  isPublished: boolean;
};

function CopyField({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable — field stays selectable.
    }
  };
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-[#1F1918]">{label}</p>
        <button
          type="button"
          onClick={copy}
          className="rounded-full border border-[#3B2F2F]/14 bg-white px-3 py-1 text-[11px] font-medium text-[#2E2323] hover:bg-[#F2EAE4]"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {helper ? <p className="mt-0.5 text-[11px] text-[#3B2F2F]/55">{helper}</p> : null}
      <textarea
        readOnly
        value={value}
        rows={Math.min(4, Math.max(1, Math.ceil(value.length / 60)))}
        className="mt-2 w-full resize-y rounded-xl border border-[#3B2F2F]/12 bg-[#FBF7F3] p-3 font-mono text-[12px] leading-relaxed text-[#1F1918] focus:border-[#2F2624]/40 focus:outline-none"
      />
    </div>
  );
}

export function PinterestSeoCard({
  draftId,
  pinterestImage,
  suggestion,
  providerConfigured,
  isPublished,
}: Props) {
  const validation = validatePinterest({
    title: suggestion.title,
    description: suggestion.description,
    image: pinterestImage,
  });
  const resolvedPin = pinterestImage ? resolveBlogImageSrc(pinterestImage) : null;
  return (
    <article className="rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-5 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#3B2F2F]/55">
            Pinterest SEO
          </p>
          <p className="mt-1 text-sm text-[#3B2F2F]/72">
            A 2:3 vertical pin is the single highest-leverage discovery asset
            for most lifestyle topics.
          </p>
        </div>
        <span className="rounded-full border border-[#3B2F2F]/14 bg-[#EEE4DB] px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-[#3B2F2F]/72">
          Fit {suggestion.suitabilityScore}/100
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-[160px_1fr]">
        <div className="overflow-hidden rounded-2xl border border-[#3B2F2F]/10 bg-[#FBF7F3]">
          {pinterestImage && resolvedPin ? (
            <SafeImage
              src={resolvedPin.src}
              alt={pinterestImage.altText}
              width={pinterestImage.width}
              height={pinterestImage.height}
              sizes="160px"
              className="h-auto w-full"
              {...(resolvedPin.blurDataURL
                ? { placeholder: "blur" as const, blurDataURL: resolvedPin.blurDataURL }
                : {})}
            />
          ) : (
            <div
              role="img"
              aria-label="No Pinterest pin yet"
              className="flex aspect-[2/3] w-full items-center justify-center bg-[#FBF7F3] px-3 text-center text-[11px] text-[#3B2F2F]/55"
            >
              No pin yet
            </div>
          )}
        </div>

        <div className="space-y-4">
          <CopyField
            label="Pinterest title"
            value={suggestion.title}
            helper="Keep under ~60 characters in the Pinterest UI for best truncation."
          />
          <CopyField
            label="Pinterest description"
            value={suggestion.description}
          />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {!isPublished ? (
          <ImageGenerateButton
            draftId={draftId}
            slot="pinterest"
            providerConfigured={providerConfigured}
            label={pinterestImage ? "Regenerate Pinterest pin" : "Generate Pinterest pin"}
          />
        ) : (
          <p className="text-xs text-[#3B2F2F]/55">
            Article is live — generate a new draft to refresh the pin.
          </p>
        )}
        <span
          className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] ${
            validation.ready
              ? "bg-[#D7ECDD] text-[#1E5A37]"
              : "bg-[#FBF3DD] text-[#5C4314]"
          }`}
        >
          {validation.ready
            ? "Pinterest-ready"
            : `${validation.failingCount} check${validation.failingCount === 1 ? "" : "s"} to address`}
        </span>
      </div>

      <details className="mt-4 rounded-2xl border border-[#3B2F2F]/10 bg-[#FBF7F3] p-3">
        <summary className="cursor-pointer text-xs font-medium uppercase tracking-[0.12em] text-[#3B2F2F]/55">
          Pinterest readiness checklist
        </summary>
        <ul className="mt-2 space-y-1.5 text-xs">
          {validation.checks.map((check) => (
            <li key={check.id} className="flex items-start gap-2">
              <span
                aria-hidden
                className={`mt-[2px] inline-block h-1.5 w-1.5 rounded-full ${
                  check.pass ? "bg-[#1E5A37]" : "bg-[#8A6A2F]"
                }`}
              />
              <div>
                <p className="font-medium text-[#1F1918]">{check.label}</p>
                <p className="text-[#3B2F2F]/72">{check.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </details>
    </article>
  );
}
