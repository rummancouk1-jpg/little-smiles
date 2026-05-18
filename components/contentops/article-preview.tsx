// Operator-facing visual preview of a draft article. Mirrors the body
// rendering of app/blog/[slug]/page.tsx so the operator sees the article
// the way a reader will — typography, spacing, section flow, CTA — without
// reading JSON.
//
// VISUAL COUPLING NOTE: this component intentionally duplicates the
// styling of the live blog page rather than extracting a shared component,
// to keep Commit I scope-respecting (no public surface touched). If
// app/blog/[slug]/page.tsx article-body styles change later, update here
// too. A future commit can extract a shared BlogArticleBody once the
// hybrid publishing path lands.
//
// The CTA renders as a styled span (not an anchor) so the operator can't
// accidentally navigate away mid-preview.

import { type BlogPost } from "@/lib/contentops/blog-schema";

type ArticlePreviewProps = {
  article: BlogPost;
};

export function ArticlePreview({ article }: ArticlePreviewProps) {
  const publishedIso = `${article.publishedAt}T12:00:00+05:00`;

  return (
    <section className="rounded-3xl border border-[#3B2F2F]/10 bg-white/85 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)]">
      <header className="border-b border-[#3B2F2F]/8 px-7 pb-4 pt-6 sm:px-9 sm:pt-7">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#3B2F2F]/55">
          Article preview · this is what readers will see
        </p>
      </header>

      <article className="px-7 py-8 sm:px-9 sm:py-10">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#3B2F2F]/52">
          {article.category}
        </p>
        <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-[#1F1918] sm:text-4xl">
          {article.title}
        </h2>
        <p className="mt-5 text-base leading-relaxed text-[#3B2F2F]/72 sm:text-lg">
          {article.description}
        </p>
        <p className="mt-4 text-xs text-[#3B2F2F]/58">
          <time dateTime={publishedIso}>
            {article.publishedAt} · {article.readTime}
          </time>
        </p>

        <div className="mt-9 space-y-8">
          {article.sections.map((section, idx) => (
            <section key={`${section.heading}-${idx}`}>
              <h3 className="text-2xl font-semibold tracking-tight text-[#241B1B]">
                {section.heading}
              </h3>
              <div className="mt-3 space-y-3 text-base leading-relaxed text-[#3B2F2F]/74">
                {section.content.map((paragraph, pIdx) => (
                  <p key={pIdx}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-[#3B2F2F]/10 bg-[#F8F2EC] p-5">
          <p className="text-sm text-[#3B2F2F]/72">
            Ready to shop products mentioned in this guide?
          </p>
          <span
            aria-disabled="true"
            className="mt-3 inline-flex cursor-default rounded-full bg-[#2F2624] px-5 py-2.5 text-sm font-medium text-[#F6F1EC]"
          >
            {article.cta.label}
          </span>
          <p className="mt-2 text-xs text-[#3B2F2F]/52">
            Links to <span className="font-mono">{article.cta.href}</span>
          </p>
        </div>
      </article>
    </section>
  );
}
