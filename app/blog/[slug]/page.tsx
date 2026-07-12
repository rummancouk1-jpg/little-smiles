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
  // Same precedence as the on-page hero + JSON-LD: reviewer override →
  // anchor product → null (in which case we let Next fall through to the
  // site-level OG default). Propagating this here keeps the social-share
  // thumbnail identical to what the article renders.
  const heroImagePath = resolveHeroImagePath(post);

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
      ...(heroImagePath ? { images: [heroImagePath] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description: post.description,
      ...(heroImagePath ? { images: [heroImagePath] } : {}),
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
    <main className="min-h-screen bg-surface-page pb-16 pt-10 sm:pt-12 lg:pt-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <article className="mx-auto max-w-4xl px-5 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-ink-base/8 bg-surface-raised/80 p-7 shadow-[0_22px_44px_-30px_rgba(59,47,47,0.4)] sm:p-10">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-ink-base/52">
            {post.category}
          </p>
          <h1 className="mt-4 text-balance text-headline font-semibold text-ink-espresso">
            {post.title}
          </h1>
          <p className="mt-5 text-base leading-relaxed text-ink-base/72 sm:text-lg">
            {post.description}
          </p>
          <p className="mt-4 text-xs text-ink-base/58">
            <time dateTime={publishedIso}>
              {post.publishedAt} · {post.readTime}
            </time>
          </p>

          {heroImagePath ? (
            <div className="relative mt-8 aspect-[16/9] w-full overflow-hidden rounded-2xl border border-ink-base/10 bg-surface-panel">
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
                <h2 className="text-2xl font-semibold tracking-tight text-ink-espresso">
                  {section.heading}
                </h2>
                <div className="mt-3 space-y-3 text-base leading-relaxed text-ink-base/74">
                  {section.content.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div className="mt-10 rounded-2xl border border-ink-base/10 bg-surface-callout p-5">
            <p className="text-sm text-ink-base/72">
              Ready to shop products mentioned in this guide?
            </p>
            <Link
              href={post.cta.href}
              className="mt-3 inline-flex rounded-full bg-accent-marigold px-5 py-2.5 text-sm font-medium text-accent-marigold-ink transition-colors hover:bg-accent-marigold/90"
            >
              {post.cta.label}
            </Link>
          </div>

          {relatedPosts.length > 0 ? (
            <section className="mt-10">
              <h2 className="text-2xl font-semibold tracking-tight text-ink-espresso">
                Related Articles
              </h2>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {relatedPosts.map((entry) => (
                  <article
                    key={entry.slug}
                    className="rounded-2xl border border-ink-base/10 bg-surface-card/95 p-4"
                  >
                    <p className="text-xs font-medium uppercase tracking-[0.1em] text-ink-base/56">
                      {entry.category}
                    </p>
                    <h3 className="mt-2 text-lg font-semibold leading-snug text-ink-espresso">
                      <Link href={`/blog/${entry.slug}`} className="hover:underline">
                        {entry.title}
                      </Link>
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-ink-base/70">
                      {entry.description}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {relatedProducts.length > 0 ? (
            <section className="mt-10">
              <h2 className="text-2xl font-semibold tracking-tight text-ink-espresso">
                Related Products
              </h2>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                {relatedProducts.map((product) => (
                  <article
                    key={product.slug}
                    className="rounded-2xl border border-ink-base/10 bg-surface-card/95 p-4"
                  >
                    <p className="text-xs font-medium uppercase tracking-[0.1em] text-ink-base/56">
                      {product.category}
                    </p>
                    <h3 className="mt-2 text-base font-semibold leading-snug text-ink-espresso">
                      <Link href={`/shop/${product.slug}`} className="hover:underline">
                        {product.name}
                      </Link>
                    </h3>
                    <div className="mt-2 flex items-center gap-2">
                      <p className="text-sm font-semibold text-ink-walnut">
                        {formatPkr(product.pricePkr)}
                      </p>
                      <p className="text-xs text-ink-base/56 line-through">
                        {formatPkr(product.compareAtPricePkr)}
                      </p>
                    </div>
                    <Link
                      href={`/shop/${product.slug}`}
                      className="mt-3 inline-flex rounded-full border border-ink-walnut/14 bg-surface-raised/70 px-3 py-1.5 text-xs font-medium text-ink-walnut transition-[background-color,border-color] duration-200 hover:border-ink-base/28 hover:bg-surface-hover"
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
