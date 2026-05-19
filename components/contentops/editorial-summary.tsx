// Quick-scan editorial summary of what's about to publish. Sits between
// the publishing destination card and the readiness panel — gives the
// operator a confidence-building read of the article's editorial vitals
// before they read the full live preview further down the page.
//
// Compact, calm, non-technical. No JSON, no schema language. Just the
// editorial essentials a non-technical operator wants to verify at a
// glance.

import type { BlogPost } from "@/lib/contentops/blog-schema";

type EditorialSummaryProps = {
  post: BlogPost;
};

export function EditorialSummary({ post }: EditorialSummaryProps) {
  const keywordCount = post.keywords.length;
  return (
    <section className="rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-7 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-9">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#3B2F2F]/55">
        Editorial summary
      </p>

      <div className="mt-5 space-y-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#3B2F2F]/55">
            Description
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[#1F1918]">
            {post.description}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#3B2F2F]/55">
              Reads in
            </p>
            <p className="mt-1 text-sm text-[#1F1918]">{post.readTime}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#3B2F2F]/55">
              Sections
            </p>
            <p className="mt-1 text-sm text-[#1F1918]">{post.sections.length}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#3B2F2F]/55">
              Keywords
            </p>
            <p className="mt-1 text-sm text-[#1F1918]">
              {keywordCount} {keywordCount === 1 ? "phrase" : "phrases"}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-[#3B2F2F]/10 bg-[#F8F2EC] p-4">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#3B2F2F]/55">
            Call to action
          </p>
          <p className="mt-2 text-sm text-[#1F1918]">
            Reads <span className="font-medium">&ldquo;{post.cta.label}&rdquo;</span>, links
            to the <span className="font-medium">{post.relatedProductCategory}</span>{" "}
            collection.
          </p>
        </div>
      </div>
    </section>
  );
}
