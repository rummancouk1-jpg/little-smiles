import Link from "next/link";

import { blogPosts } from "@/lib/blog";
import { breadcrumbJsonLdDocument } from "@/lib/json-ld";
import { staticPageMetadata } from "@/lib/seo-metadata";

export const metadata = staticPageMetadata({
  title: "Baby & Parenting Guides (Pakistan)",
  description:
    "Parent-focused guides on newborn essentials, feeding, and practical baby product choices in Pakistan—by Little Smiles.",
  path: "/blog",
});

const blogIndexBreadcrumbLd = breadcrumbJsonLdDocument([
  { name: "Home", path: "/" },
  { name: "Journal", path: "/blog" },
]);

export default function BlogPage() {
  const sortedPosts = [...blogPosts].sort((a, b) =>
    b.publishedAt.localeCompare(a.publishedAt)
  );

  return (
    <main className="min-h-screen bg-surface-page pb-16 pt-10 sm:pt-12 lg:pt-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogIndexBreadcrumbLd) }}
      />
      <section className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-ink-base/50">
            Little Smiles Journal
          </p>
          <h1 className="mt-4 text-headline font-semibold text-ink-walnut">
            Parenting Guides and Buying Advice
          </h1>
          <p className="mt-4 text-base leading-relaxed text-ink-base/70 sm:text-lg">
            Practical, premium-first advice for newborn essentials, feeding, and
            everyday baby comfort.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-5 sm:mt-12 md:grid-cols-2 lg:grid-cols-3">
          {sortedPosts.map((post) => (
            <article
              key={post.slug}
              className="flex h-full flex-col rounded-3xl border border-ink-base/9 bg-surface-card/94 p-5 shadow-[0_24px_52px_-34px_rgba(59,47,47,0.36)]"
            >
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-ink-base/56">
                {post.category}
              </p>
              <h2 className="mt-3 text-2xl font-semibold leading-tight text-ink-espresso">
                <Link href={`/blog/${post.slug}`} className="hover:underline">
                  {post.title}
                </Link>
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-ink-base/70">
                {post.description}
              </p>
              <p className="mt-auto pt-4 text-xs text-ink-base/58">
                {post.publishedAt} - {post.readTime}
              </p>
              <Link
                href={`/blog/${post.slug}`}
                className="mt-5 inline-flex rounded-full border border-ink-walnut/14 bg-white/70 px-4 py-2 text-sm font-medium text-ink-walnut transition-[background-color,border-color] duration-200 hover:border-ink-base/28 hover:bg-surface-hover"
              >
                Read Article
              </Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
