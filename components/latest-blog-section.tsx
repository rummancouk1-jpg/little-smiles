import Link from "next/link";

import type { BlogPost } from "@/lib/blog";

type LatestBlogSectionProps = {
  posts: BlogPost[];
};

export function LatestBlogSection({ posts }: LatestBlogSectionProps) {
  if (posts.length === 0) return null;

  return (
    <section className="relative overflow-hidden bg-transparent pb-18 pt-8 sm:pb-22 sm:pt-10 lg:pb-26 lg:pt-12">
      <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#3B2F2F]/50">
              From the Blog
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#1F1918] sm:text-4xl">
              Latest Parenting Guides
            </h2>
          </div>
          <Link
            href="/blog"
            className="inline-flex rounded-full border border-[#2E2323]/14 bg-white/68 px-4 py-2 text-sm font-medium text-[#2E2323] transition-[background-color,border-color] duration-200 hover:border-[#3B2F2F]/28 hover:bg-[#F2EAE4]"
          >
            View All Articles
          </Link>
        </div>

        <div className="mobile-rail mt-8 flex snap-x gap-4 overflow-x-auto pb-1 sm:mt-10 sm:grid sm:grid-cols-2 sm:gap-5 sm:overflow-visible lg:grid-cols-3">
          {posts.map((post) => (
            <article
              key={post.slug}
              className="min-w-[84%] snap-start rounded-3xl border border-[#3B2F2F]/9 bg-[#FCF8F4]/94 p-5 shadow-[0_24px_52px_-34px_rgba(59,47,47,0.36)] sm:flex sm:min-h-[16rem] sm:min-w-0 sm:flex-col"
            >
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#3B2F2F]/56">
                {post.category}
              </p>
              <h3 className="mt-3 text-2xl font-semibold leading-tight text-[#1F1918]">
                <Link href={`/blog/${post.slug}`} className="hover:underline">
                  {post.title}
                </Link>
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-[#3B2F2F]/70">
                {post.description}
              </p>
              <p className="mt-auto pt-4 text-xs text-[#3B2F2F]/58">
                {post.publishedAt} - {post.readTime}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
