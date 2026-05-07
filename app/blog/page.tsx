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
    <main className="min-h-screen bg-[#F9F5F1] pb-16 pt-10 sm:pt-12 lg:pt-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogIndexBreadcrumbLd) }}
      />
      <section className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#3B2F2F]/50">
            Little Smiles Journal
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[#2E2323] sm:text-5xl">
            Parenting Guides and Buying Advice
          </h1>
          <p className="mt-4 text-base leading-relaxed text-[#3B2F2F]/70 sm:text-lg">
            Practical, premium-first advice for newborn essentials, feeding, and
            everyday baby comfort.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-5 sm:mt-12 md:grid-cols-2 lg:grid-cols-3">
          {sortedPosts.map((post) => (
            <article
              key={post.slug}
              className="flex h-full flex-col rounded-3xl border border-[#3B2F2F]/9 bg-[#FCF8F4]/94 p-5 shadow-[0_24px_52px_-34px_rgba(59,47,47,0.36)]"
            >
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#3B2F2F]/56">
                {post.category}
              </p>
              <h2 className="mt-3 text-2xl font-semibold leading-tight text-[#1F1918]">
                <Link href={`/blog/${post.slug}`} className="hover:underline">
                  {post.title}
                </Link>
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[#3B2F2F]/70">
                {post.description}
              </p>
              <p className="mt-auto pt-4 text-xs text-[#3B2F2F]/58">
                {post.publishedAt} - {post.readTime}
              </p>
              <Link
                href={`/blog/${post.slug}`}
                className="mt-5 inline-flex rounded-full border border-[#2E2323]/14 bg-white/70 px-4 py-2 text-sm font-medium text-[#2E2323] transition-colors hover:bg-white/92"
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
