import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { blogPosts, getBlogPostBySlug, resolveHeroImagePath } from "@/lib/blog";
import { blogPostingJsonLd, breadcrumbJsonLdDocument } from "@/lib/json-ld";
import { formatPkr, products } from "@/lib/products";
import { siteUrl } from "@/lib/site";

type BlogPostPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  return blogPosts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);

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
  const post = getBlogPostBySlug(slug);

  if (!post) notFound();
  const relatedPosts = blogPosts
    .filter((entry) => entry.slug !== post.slug)
    .slice(0, 2);
  const relatedProducts = products
    .filter((product) => product.category === post.relatedProductCategory)
    .slice(0, 3);

  const structuredData = blogPostingJsonLd(post);
  const publishedIso = `${post.publishedAt}T12:00:00+05:00`;
  const heroImagePath = resolveHeroImagePath(post);
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
                alt={`${post.title} hero image`}
                fill
                sizes="(min-width: 1024px) 768px, 100vw"
                className="object-cover"
                priority
              />
            </div>
          ) : null}

          <div className="mt-9 space-y-8">
            {post.sections.map((section) => (
              <section key={section.heading}>
                <h2 className="text-2xl font-semibold tracking-tight text-[#241B1B]">
                  {section.heading}
                </h2>
                <div className="mt-3 space-y-3 text-base leading-relaxed text-[#3B2F2F]/74">
                  {section.content.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
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
