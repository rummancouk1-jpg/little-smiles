// Reader-facing preview of a draft. Renders the body content using the
// SAME max-width, headings, paragraph rhythm, and visual structure as the
// public blog post page (app/blog/[slug]/page.tsx). Keep this separate
// from admin diagnostics — operators look at the diagnostics panels for
// numbers; this one shows them how a reader will experience the post.
//
// IMPORTANT: this component is purely presentational. If the public blog
// page's typography changes, mirror that change here so the preview stays
// honest.

import Image from "next/image";
import Link from "next/link";

import { type BlogPost } from "@/lib/contentops/blog-schema";

type Props = {
  post: BlogPost;
  heroImagePath: string | null;
};

export function WebsitePreview({ post, heroImagePath }: Props) {
  const publishedIso = `${post.publishedAt}T12:00:00+05:00`;

  return (
    <section className="rounded-3xl border border-[#3B2F2F]/10 bg-[#F9F5F1] p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 px-2 pb-3">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#3B2F2F]/55">
          Website preview
        </p>
        <p className="text-[11px] text-[#3B2F2F]/55">
          Reader view — typography, spacing, and width mirror{" "}
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
                    <p key={`p-${sIdx}-${pIdx}`}>{paragraph}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>

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
