// Reader-facing preview of a draft. Renders the body content using the
// SAME max-width, headings, paragraph rhythm, and visual structure as the
// public blog post page (app/blog/[slug]/page.tsx).
//
// Hero image precedence here MUST stay identical to
// `lib/blog.ts:resolveHeroImagePath()` so the reviewer sees exactly what
// publishes:
//   1. an explicit `post.heroImage` (reviewer override propagated by the
//      publish adapter)
//   2. the auto-resolved anchor product image (caller supplies the
//      fallback as `fallbackHeroImagePath`)
//   3. nothing — render without a hero
//
// Keep this component presentational. If the public blog page's typography
// or image rules change, mirror that change here so the preview stays honest.

import Image from "next/image";
import Link from "next/link";

import { RichParagraph } from "@/components/blog-rich-text";
import { type BlogPost } from "@/lib/contentops/blog-schema";

type Props = {
  post: BlogPost;
  /**
   * Auto-resolved fallback path used when `post.heroImage` is not set
   * (typically `getBlogAnchorProduct(post)?.image`). Pass `null` when no
   * fallback can be derived; the preview will render without a hero.
   */
  fallbackHeroImagePath: string | null;
};

function resolveHeroPath(post: BlogPost, fallback: string | null): string | null {
  const explicit = post.heroImage?.trim();
  if (explicit && explicit.length > 0) return explicit;
  return fallback;
}

export function WebsitePreview({ post, fallbackHeroImagePath }: Props) {
  const publishedIso = `${post.publishedAt}T12:00:00+05:00`;
  const heroImagePath = resolveHeroPath(post, fallbackHeroImagePath);

  return (
    <section className="rounded-3xl border border-[#3B2F2F]/10 bg-[#F9F5F1] p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 px-2 pb-3">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#3B2F2F]/55">
          Website preview
        </p>
        <p className="text-[11px] text-[#3B2F2F]/55">
          Reader view — typography, spacing, and image resolution mirror{" "}
          <code className="font-mono">/blog/{post.slug}</code>.
        </p>
      </div>
      <article className="mx-auto max-w-4xl">
        <div className="rounded-3xl border border-[#3B2F2F]/8 bg-white/80 p-7 shadow-[0_22px_44px_-30px_rgba(59,47,47,0.4)] sm:p-10">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#3B2F2F]/52">
            {post.category}
          </p>
          <h1 className="mt-4 text-balance text-4xl font-semibold tracking-tight text-[#1F1918] sm:text-5xl">
            {post.title}
          </h1>
          <p className="mt-5 text-base leading-relaxed text-[#3B2F2F]/72 sm:text-lg">
            {post.description}
          </p>
          <p className="mt-4 text-xs text-[#3B2F2F]/58">
            <time dateTime={publishedIso}>
              {post.publishedAt} · {post.readTime}
            </time>
          </p>

          {heroImagePath ? (
            <div className="relative mt-8 aspect-[16/9] w-full overflow-hidden rounded-2xl border border-[#3B2F2F]/10 bg-[#FBF7F3]">
              <Image
                src={heroImagePath}
                alt={`${post.title} hero image preview`}
                fill
                sizes="(min-width: 768px) 768px, 100vw"
                className="object-cover"
                unoptimized
              />
            </div>
          ) : null}

          <div className="mt-9 space-y-8">
            {post.sections.map((section, sIdx) => (
              <section key={`${section.heading}-${sIdx}`}>
                <h2 className="text-2xl font-semibold tracking-tight text-[#241B1B]">
                  {section.heading}
                </h2>
                <div className="mt-3 space-y-3 text-base leading-relaxed text-[#3B2F2F]/74">
                  {section.content.map((paragraph, pIdx) => (
                    <RichParagraph key={`p-${sIdx}-${pIdx}`} text={paragraph} />
                  ))}
                </div>
              </section>
            ))}
          </div>

          {post.faq && post.faq.length > 0 ? (
            <section className="mt-10">
              <h2 className="text-2xl font-semibold tracking-tight text-[#241B1B]">
                Frequently asked questions
              </h2>
              <dl className="mt-4 space-y-4">
                {post.faq.map((item, fIdx) => (
                  <div
                    key={`faq-${fIdx}`}
                    className="rounded-2xl border border-dashed border-[#3B2F2F]/25 bg-white/70 p-4"
                  >
                    <dt className="font-semibold text-[#1F1918]">{item.question}</dt>
                    <dd className="mt-1.5 text-sm leading-relaxed text-[#3B2F2F]/74">
                      <RichParagraph text={item.answer} />
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          <div className="mt-10 rounded-2xl border border-[#3B2F2F]/10 bg-[#F8F2EC] p-5">
            <p className="text-sm text-[#3B2F2F]/72">
              Ready to shop products mentioned in this guide?
            </p>
            <Link
              href={post.cta.href}
              className="mt-3 inline-flex rounded-full bg-[#2F2624] px-5 py-2.5 text-sm font-medium text-[#F6F1EC] transition-colors hover:bg-[#251E1D]"
            >
              {post.cta.label}
            </Link>
          </div>
        </div>
      </article>
    </section>
  );
}
