// Media confidence card. Two states:
//   - Hero attached  → elegant preview with alt text, thumbnail status,
//                       small "Manage media →" link.
//   - Hero missing   → calm one-line recommendation, no alarm.
//
// Image-source agnostic; the card reads the same whether the hero was
// uploaded as photography, AI output, or curated stock. No technical
// language, no dimensions tables, no MIME types in the operator view.

import Link from "next/link";

import { SafeImage } from "@/components/contentops/safe-image";
import type { BlogImage } from "@/lib/contentops/blog-schema";
import { resolveBlogImageSrc } from "@/lib/contentops/image-render";

type MediaConfidenceProps = {
  hero: BlogImage | null;
  thumbnail: BlogImage | null;
  draftId: string;
};

function ManageLink({ draftId, label }: { draftId: string; label: string }) {
  return (
    <Link
      href={`/admin/contentops/${draftId}/images`}
      className="text-xs font-medium text-[#1F1918] underline underline-offset-2 hover:text-[#3B2F2F]"
    >
      {label} →
    </Link>
  );
}

export function MediaConfidence({ hero, thumbnail, draftId }: MediaConfidenceProps) {
  if (!hero) {
    return (
      <section className="rounded-3xl border border-[#8A6A2F]/20 bg-[#FBF5EA] p-7 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-9">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#5E4A1C]">
          Hero imagery
        </p>
        <p className="mt-3 text-sm leading-relaxed text-[#1F1918]">
          This article would benefit from a hero image before publishing. Visuals
          make the article feel finished and help cards on the blog index pick up
          the right preview.
        </p>
        <div className="mt-5">
          <ManageLink draftId={draftId} label="Manage media" />
        </div>
      </section>
    );
  }

  const thumbnailMatchesHero =
    thumbnail && hero && thumbnail.url === hero.url;

  return (
    <section className="rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-7 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-9">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#3B2F2F]/55">
          Hero imagery
        </p>
        <span className="rounded-full bg-[#D7ECDD] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-[#1E5A37]">
          Attached
        </span>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-[1fr_1.4fr]">
        <div className="overflow-hidden rounded-2xl border border-[#3B2F2F]/10 bg-[#FBF7F3]">
          {(() => {
            const resolved = resolveBlogImageSrc(hero);
            return (
              <SafeImage
                src={resolved.src}
                alt={hero.altText}
                width={hero.width}
                height={hero.height}
                sizes="(max-width: 768px) 100vw, 360px"
                className="h-auto w-full"
                {...(resolved.blurDataURL
                  ? { placeholder: "blur" as const, blurDataURL: resolved.blurDataURL }
                  : {})}
              />
            );
          })()}
        </div>

        <div className="space-y-4 text-sm">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#3B2F2F]/55">
              Alt text
            </p>
            <p className="mt-1 text-[#1F1918]">{hero.altText}</p>
          </div>
          {hero.caption ? (
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#3B2F2F]/55">
                Caption
              </p>
              <p className="mt-1 italic text-[#3B2F2F]/85">{hero.caption}</p>
            </div>
          ) : null}
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#3B2F2F]/55">
              Thumbnail
            </p>
            <p className="mt-1 text-[#1F1918]">
              {thumbnail && !thumbnailMatchesHero
                ? "Dedicated thumbnail attached."
                : "Hero image is used on cards and social previews."}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5">
        <ManageLink draftId={draftId} label="Manage media" />
      </div>
    </section>
  );
}
