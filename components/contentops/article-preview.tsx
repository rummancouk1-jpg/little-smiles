// Operator-facing visual preview of a draft article. Uses the shared
// BlogArticleBody so the preview tracks the public /blog/[slug] layout
// pixel-for-pixel without manual sync.
//
// Outer structure: a card with an "Article preview" eyebrow header,
// containing the rendered body. titleLevel=2 because the publish page
// already owns the h1; the article title becomes the h2 within this
// nested context. ctaInteractive=false so the operator can't
// accidentally navigate away from publish-prep mid-preview.

import { BlogArticleBody } from "@/components/blog-article-body";
import { type BlogPost } from "@/lib/contentops/blog-schema";

type ArticlePreviewProps = {
  article: BlogPost;
};

export function ArticlePreview({ article }: ArticlePreviewProps) {
  return (
    <section className="rounded-3xl border border-[#3B2F2F]/10 bg-white/85 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)]">
      <header className="border-b border-[#3B2F2F]/8 px-7 pb-5 pt-6 sm:px-9 sm:pt-7">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#3B2F2F]/55">
          Live article preview
        </p>
        <p className="mt-1 text-sm text-[#3B2F2F]/72">
          This is how the article will appear on the public site.
        </p>
      </header>

      <article className="px-7 py-8 sm:px-9 sm:py-10">
        <BlogArticleBody post={article} titleLevel={2} ctaInteractive={false} />
      </article>
    </section>
  );
}
