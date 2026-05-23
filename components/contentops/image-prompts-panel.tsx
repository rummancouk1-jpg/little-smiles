// Image prompts panel — renders three deterministic copy-ready prompts
// for blog hero / Pinterest / lifestyle imagery. No image generation
// runs from here. The "Generate image" CTA stays disabled unless explicit
// env flags are on, and even then it remains a manual action.

import { CopyTextButton } from "@/components/admin/copy-text-button";
import type { ImagePromptSet } from "@/lib/contentops/image-prompts";

type Props = {
  prompts: ImagePromptSet;
  draftId: string;
  draftSlug: string;
};

type Variant = {
  key: "hero" | "pinterest" | "lifestyle";
  title: string;
  subtitle: string;
  text: string;
};

export function ImagePromptsPanel({ prompts, draftId, draftSlug }: Props) {
  const variants: Variant[] = [
    {
      key: "hero",
      title: "Blog hero (16:9)",
      subtitle: "Horizontal lead image. Used as the post's open-graph card and inline above the article.",
      text: prompts.hero,
    },
    {
      key: "pinterest",
      title: "Pinterest pin (2:3)",
      subtitle: "Tall vertical asset optimised for Pinterest's thumbnail crop. Subject in the upper two-thirds.",
      text: prompts.pinterest,
    },
    {
      key: "lifestyle",
      title: "Product-support lifestyle (1:1)",
      subtitle: "Square in-use shot for product pages, social posts, or inline product callouts.",
      text: prompts.lifestyle,
    },
  ];

  return (
    <article className="rounded-3xl border border-[#3B2F2F]/10 bg-white/90 p-5 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-[#1F1918]">AI image prompts</h3>
          <p className="mt-1 text-xs text-[#3B2F2F]/65">
            Copy a prompt and paste it into any external image model. No image is generated from this dashboard.
            Brand style, baby-safe constraints, and &ldquo;no text / no logos&rdquo; are baked into every prompt.
          </p>
        </div>
        <span className="inline-flex rounded-full bg-[#EEE4DB] px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-[#2E2323]">
          Generation: {prompts.generationAvailable ? "manual only" : "disabled"}
        </span>
      </header>

      <ul className="mt-3 space-y-3">
        {variants.map((variant) => (
          <li key={variant.key} className="rounded-2xl border border-[#3B2F2F]/10 bg-[#FDF8F4] p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-[#1F1918]">{variant.title}</p>
                <p className="mt-0.5 text-xs text-[#3B2F2F]/72">{variant.subtitle}</p>
              </div>
              <CopyTextButton
                text={variant.text}
                label={`Copy ${variant.key} prompt`}
                auditAction="image_prompt_copied"
                auditMetadata={{ variant: variant.key, draftId, draftSlug }}
              />
            </div>
            <details className="mt-2">
              <summary className="cursor-pointer text-[11px] font-medium text-[#2E2323]">Preview prompt</summary>
              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-xl bg-white p-3 text-[11px] leading-relaxed text-[#1F1918]">
{variant.text}
              </pre>
            </details>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-[11px] text-[#3B2F2F]/65">
        {prompts.generationAvailable
          ? "Assisted generation is enabled but stays a manual per-draft action — it never runs in the cron path."
          : `Assisted generation is disabled. ${prompts.generationDisabledReason}`}
      </p>
      <p className="mt-2 rounded-xl border border-[#7A4A12]/20 bg-[#FBF5EA] px-3 py-2 text-[11px] leading-relaxed text-[#5E4A1C]">
        <span className="font-semibold uppercase tracking-wide">Safety:</span> AI image generation
        is disabled unless explicitly configured. An admin must approve any generated or uploaded
        image before publishing.
      </p>
    </article>
  );
}
