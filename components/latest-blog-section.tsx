import Image from "next/image";
import Link from "next/link";

import { getBlogAnchorProduct, type BlogPost } from "@/lib/blog";

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
            <p className="eyebrow">Notes</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#1F1918] sm:text-4xl">
              Reading for new parents
            </h2>
          </div>
          <Link
            href="/blog"
            className="group inline-flex items-center gap-1.5 text-sm font-medium text-[#2E2323] underline decoration-[#3B2F2F]/22 underline-offset-[6px] transition-[color,text-decoration-color] duration-200 hover:text-[#1F1918] hover:decoration-[#1F1918]/45"
          >
            View all articles
            <span
              aria-hidden
              className="text-[0.95em] leading-none transition-transform duration-200 group-hover:translate-x-0.5"
            >
              →
            </span>
          </Link>
        </div>

        <div className="mobile-rail mt-8 flex snap-x gap-4 overflow-x-auto pb-1 sm:mt-10 sm:grid sm:snap-none sm:grid-cols-2 sm:gap-5 sm:overflow-visible lg:grid-cols-3">
          {posts.map((post) => {
            const anchor = getBlogAnchorProduct(post);
            return (
              <article
                key={post.slug}
                className="group flex min-w-[84%] snap-start flex-col overflow-hidden rounded-3xl border border-[#3B2F2F]/9 bg-[#FCF8F4]/94 shadow-card-rest transition-[box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:shadow-card-lift sm:min-w-0"
              >
                <Link
                  href={`/blog/${post.slug}`}
                  className="relative block aspect-[5/3] overflow-hidden bg-[#F5EEE7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E2323]/24"
                  aria-hidden
                  tabIndex={-1}
                >
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_15%,rgba(255,255,255,0.55),transparent_62%)]" />
                  {anchor ? (
                    <Image
                      src={anchor.image}
                      // The wrapping <Link> is aria-hidden + tabIndex=-1, so
                      // assistive tech ignores this image. The alt is for
                      // image-search bots (Google Images indexes the file
                      // and associates it with this article's URL).
                      alt={anchor.name}
                      fill
                      sizes="(max-width: 640px) 84vw, (max-width: 1024px) 46vw, 30vw"
                      className="object-contain object-center p-6 transition-transform duration-500 group-hover:scale-[1.02]"
                    />
                  ) : null}
                </Link>

                <div className="flex flex-1 flex-col gap-3 p-5 sm:p-6">
                  <p className="eyebrow">{post.category}</p>
                  <h3 className="text-[1.5rem] leading-[1.15] text-[#1F1918] sm:text-[1.65rem]">
                    <Link
                      href={`/blog/${post.slug}`}
                      className="rounded-md hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E2323]/24"
                    >
                      {post.title}
                    </Link>
                  </h3>
                  <p className="text-sm leading-relaxed text-[#3B2F2F]/72">
                    {post.description}
                  </p>
                  <p className="mt-auto pt-2 text-xs text-[#3B2F2F]/58">
                    {post.publishedAt} · {post.readTime}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
