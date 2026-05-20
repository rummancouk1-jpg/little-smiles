import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BlogArticleBody } from "@/components/blog-article-body";
import {
  blogPosts,
  getAllBlogPosts,
  getBlogPostBySlugAsync,
} from "@/lib/blog";
import { computeLinkingSuggestions } from "@/lib/contentops/intelligence/relationships";
import { blogPostingJsonLd, breadcrumbJsonLdDocument } from "@/lib/json-ld";
import { formatPkr, products } from "@/lib/products";
import { siteUrl } from "@/lib/site";

type BlogPostPageProps = {
  params: Promise<{ slug: string }>;
};

// Five-minute ISR. Known static slugs are pre-rendered via
// generateStaticParams; Supabase-only slugs render on-demand and get
// cached per the revalidate window. Commit L will pair this with
// revalidatePath() on publish for instant visibility.
export const revalidate = 300;

// Allow on-demand rendering for slugs not in the static seed (i.e. those
// born in Supabase after build). Default behaviour, declared explicitly
// so the contract is visible at the file head.
export const dynamicParams = true;

export async function generateStaticParams() {
  // Pre-render the static seed only. Including Supabase drafts here
  // would couple builds to DB availability without meaningful upside:
  // ISR handles dynamic slugs at first request and caches the result.
  return blogPosts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPostBySlugAsync(slug);

  if (!post) {
    return {
      title: "Not found",
      robots: { index: false, follow: true },
    };
  }

  const canonical = `${siteUrl}/blog/${post.slug}`;
  const publishedIso = `${post.publishedAt}T12:00:00+05:00`;
  const socialTitle = `${post.title} | Little Smiles`;

  return {
    title: post.title,
    description: post.description,
    keywords: post.keywords,
    alternates: { canonical },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true },
    },
    openGraph: {
      title: socialTitle,
      description: post.description,
      type: "article",
      url: canonical,
      locale: "en_PK",
      siteName: "Little Smiles",
      publishedTime: publishedIso,
      modifiedTime: publishedIso,
      authors: ["Little Smiles"],
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description: post.description,
    },
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = await getBlogPostBySlugAsync(slug);

  if (!post) notFound();

  // Related posts + products are now ranked by the editorial intelligence
  // engine instead of the naive "first 2" / "category match" selectors.
  // Same data sources — static seed + Supabase-published drafts — just
  // ordered by topical resonance (shared anchor collection, shared
  // category, keyword overlap).
  const allPosts = await getAllBlogPosts();
  const suggestions = computeLinkingSuggestions({
    article: post,
    candidates: allPosts,
    products,
  });
  const relatedPosts = suggestions.relatedArticles.slice(0, 2).map((r) => r.article);
  const relatedProducts = suggestions.relatedProducts
    .slice(0, 3)
    .map((r) => r.product);

  const structuredData = blogPostingJsonLd(post);
  const breadcrumbLd = breadcrumbJsonLdDocument([
    { name: "Home", path: "/" },
    { name: "Journal", path: "/blog" },
    { name: post.title, path: `/blog/${post.slug}` },
  ]);

  return (
    <main className="min-h-screen bg-[#F9F5F1] pb-16 pt-10 sm:pt-12 lg:pt-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <article className="mx-auto max-w-4xl px-5 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-[#3B2F2F]/8 bg-white/80 p-7 shadow-[0_22px_44px_-30px_rgba(59,47,47,0.4)] sm:p-10">
          <BlogArticleBody post={post} titleLevel={1} ctaInteractive />

          {relatedPosts.length > 0 ? (
            <section className="mt-10">
              <h2 className="text-2xl font-semibold tracking-tight text-[#241B1B]">
                Related Articles
              </h2>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {relatedPosts.map((entry) => (
                  <article
                    key={entry.slug}
                    className="rounded-2xl border border-[#3B2F2F]/10 bg-[#FCF8F4]/95 p-4"
                  >
                    <p className="text-xs font-medium uppercase tracking-[0.1em] text-[#3B2F2F]/56">
                      {entry.category}
                    </p>
                    <h3 className="mt-2 text-lg font-semibold leading-snug text-[#1F1918]">
                      <Link href={`/blog/${entry.slug}`} className="hover:underline">
                        {entry.title}
                      </Link>
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-[#3B2F2F]/70">
                      {entry.description}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {relatedProducts.length > 0 ? (
            <section className="mt-10">
              <h2 className="text-2xl font-semibold tracking-tight text-[#241B1B]">
                Related Products
              </h2>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                {relatedProducts.map((product) => (
                  <article
                    key={product.slug}
                    className="rounded-2xl border border-[#3B2F2F]/10 bg-[#FCF8F4]/95 p-4"
                  >
                    <p className="text-xs font-medium uppercase tracking-[0.1em] text-[#3B2F2F]/56">
                      {product.category}
                    </p>
                    <h3 className="mt-2 text-base font-semibold leading-snug text-[#1F1918]">
                      <Link href={`/shop/${product.slug}`} className="hover:underline">
                        {product.name}
                      </Link>
                    </h3>
                    <div className="mt-2 flex items-center gap-2">
                      <p className="text-sm font-semibold text-[#2E2323]">
                        {formatPkr(product.pricePkr)}
                      </p>
                      <p className="text-xs text-[#3B2F2F]/56 line-through">
                        {formatPkr(product.compareAtPricePkr)}
                      </p>
                    </div>
                    <Link
                      href={`/shop/${product.slug}`}
                      className="mt-3 inline-flex rounded-full border border-[#2E2323]/14 bg-white/70 px-3 py-1.5 text-xs font-medium text-[#2E2323] transition-[background-color,border-color] duration-200 hover:border-[#3B2F2F]/28 hover:bg-[#F2EAE4]"
                    >
                      View Product
                    </Link>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </article>
    </main>
  );
}
