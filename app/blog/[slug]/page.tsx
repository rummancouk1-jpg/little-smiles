import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { RichParagraph } from "@/components/blog-rich-text";
import { ProductImage } from "@/components/product-image";
import { categoryMatClass } from "@/components/product-grid";
import { resolveHeroImagePath } from "@/lib/blog";
import { getAllBlogPosts, getAnyBlogPostBySlug } from "@/lib/blog-data";
import { blogPostingJsonLd, breadcrumbJsonLdDocument, faqPageJsonLd } from "@/lib/json-ld";
import { formatPkr, getImageCandidates, products } from "@/lib/products";
import { siteUrl } from "@/lib/site";
import { cn } from "@/lib/utils";

type BlogPostPageProps = {
  params: Promise<{ slug: string }>;
};

/* Admin-published posts appear after the build — render unknown slugs on
   demand (then cache), with an hourly ISR safety net behind the publish
   action's on-demand revalidation. */
export const dynamicParams = true;
export const revalidate = 3600;

export async function generateStaticParams() {
  const posts = await getAllBlogPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getAnyBlogPostBySlug(slug);

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
  const post = await getAnyBlogPostBySlug(slug);

  if (!post) notFound();
  const allPosts = await getAllBlogPosts();
  const relatedPosts = allPosts
    .filter((entry) => entry.slug !== post.slug)
    .slice(0, 2);
  const relatedProducts = products
    .filter((product) => product.category === post.relatedProductCategory)
    .slice(0, 3);

  const structuredData = blogPostingJsonLd(post);
  const faq = post.faq ?? [];
  const faqStructuredData = faq.length > 0 ? faqPageJsonLd(faq) : null;
  const publishedIso = `${post.publishedAt}T12:00:00+05:00`;
  const heroImagePath = resolveHeroImagePath(post);
  const breadcrumbLd = breadcrumbJsonLdDocument([
    { name: "Home", path: "/" },
    { name: "Journal", path: "/blog" },
    { name: post.title, path: `/blog/${post.slug}` },
  ]);

  return (
    <main className="min-h-screen bg-surface-page pb-20 pt-8 sm:pt-10 lg:pt-14">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      {faqStructuredData ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqStructuredData) }}
        />
      ) : null}

      <article className="mx-auto max-w-[44rem] px-5 sm:px-6">
        {/* Editorial header — content on the paper ground, no enclosing box. */}
        <header className="text-center">
          <Link
            href="/blog"
            className="group inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.16em] text-ink-base/55 transition-colors hover:text-ink-walnut"
          >
            <span aria-hidden className="transition-transform group-hover:-translate-x-0.5">
              ←
            </span>
            Journal
          </Link>
          <p className="eyebrow mt-6">{post.category}</p>
          <h1 className="mt-4 text-balance text-headline font-semibold text-ink-strong">
            {post.title}
          </h1>
          <p className="mx-auto mt-5 max-w-[36rem] text-pretty text-lg leading-relaxed text-ink-base/72">
            {post.description}
          </p>
          <p className="mt-5 text-xs uppercase tracking-[0.14em] text-ink-base/55">
            <time dateTime={publishedIso}>{post.publishedAt}</time>
            <span aria-hidden className="mx-2 text-ink-base/35">
              ·
            </span>
            {post.readTime}
          </p>
        </header>

        {/* The Arch — hero product seated on its category mat, the signature. */}
        {heroImagePath ? (
          <div
            className={cn(
              "arch-frame mx-auto mt-9 max-w-[30rem] pb-8 pt-11 sm:mt-10",
              categoryMatClass[post.relatedProductCategory] ?? "bg-mat-butter",
            )}
          >
            <div className="relative mx-auto aspect-square w-[68%]">
              <Image
                src={heroImagePath}
                alt={`${post.title} — ${post.relatedProductCategory} by Little Smiles`}
                fill
                sizes="(min-width: 640px) 30rem, 90vw"
                className="object-contain object-center"
                priority
              />
            </div>
            <div aria-hidden className="arch-floor bottom-[5%] h-4 w-[54%]" />
          </div>
        ) : null}

        {/* Long-form body — comfortable measure, generous rhythm, Fraunces
            section headings (via the global h2 rule). */}
        <div className="mt-12 space-y-10">
          {post.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-2xl font-semibold text-ink-strong sm:text-[1.7rem]">
                {section.heading}
              </h2>
              <div className="mt-4 space-y-4 text-lg leading-[1.75] text-ink-base/80">
                {section.content.map((paragraph) => (
                  <RichParagraph key={paragraph} text={paragraph} />
                ))}
              </div>
            </section>
          ))}
        </div>

        {faq.length > 0 ? (
          <section className="mt-14">
            <h2 className="text-2xl font-semibold text-ink-strong sm:text-[1.7rem]">
              Frequently asked questions
            </h2>
            <dl className="mt-5 space-y-3">
              {faq.map((item) => (
                <div
                  key={item.question}
                  className="rounded-2xl border border-dashed border-ink-base/25 bg-surface-raised/55 p-5"
                >
                  <dt className="font-heading text-lg font-semibold text-ink-strong">
                    {item.question}
                  </dt>
                  <dd className="mt-2 text-base leading-relaxed text-ink-base/76">
                    <RichParagraph text={item.answer} />
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}

        {/* Conversion moment — warm marigold callout, arch-topped. */}
        <aside
          className={cn(
            "arch-frame mt-14 px-6 pb-8 pt-10 text-center",
            categoryMatClass[post.relatedProductCategory] ?? "bg-mat-butter",
          )}
        >
          <p className="mx-auto max-w-[28rem] font-heading text-2xl font-semibold leading-snug text-ink-strong">
            Ready to shop the pieces from this guide?
          </p>
          <Link
            href={post.cta.href}
            className="mt-5 inline-flex h-12 items-center rounded-full bg-accent-marigold px-8 text-sm font-semibold text-accent-marigold-ink shadow-cta transition-[transform,box-shadow,background-color] duration-300 hover:-translate-y-0.5 hover:bg-accent-marigold-deep"
          >
            {post.cta.label}
          </Link>
        </aside>

        {relatedProducts.length > 0 ? (
          <section className="mt-14">
            <h2 className="text-center text-2xl font-semibold text-ink-strong sm:text-[1.7rem]">
              Pieces mentioned here
            </h2>
            <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3">
              {relatedProducts.map((product) => (
                <article key={product.slug} className="group flex flex-col text-center">
                  <Link
                    href={`/shop/${product.slug}`}
                    className="block rounded-t-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-walnut/30"
                  >
                    <div
                      className={cn(
                        "arch-frame pb-4 pt-6 shadow-card-rest transition-[transform,box-shadow] duration-300 group-hover:-translate-y-1 group-hover:shadow-card-lift",
                        categoryMatClass[product.category] ?? "bg-mat-butter",
                      )}
                    >
                      <div className="relative mx-auto aspect-square w-[70%]">
                        <ProductImage
                          sources={getImageCandidates(product.image)}
                          alt={`${product.name} by Little Smiles`}
                          fill
                          sizes="(max-width: 640px) 45vw, 15rem"
                          className="object-contain object-center"
                        />
                      </div>
                      <div aria-hidden className="arch-floor bottom-[4%] h-2.5 w-[50%]" />
                    </div>
                    <h3 className="mt-3 text-sm font-semibold leading-snug text-ink-strong group-hover:underline">
                      {product.name}
                    </h3>
                  </Link>
                  <p className="mt-1 font-heading text-base font-semibold tabular-nums text-ink-strong">
                    {formatPkr(product.pricePkr)}
                  </p>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {relatedPosts.length > 0 ? (
          <section className="mt-14 border-t border-ink-base/12 pt-10">
            <h2 className="text-2xl font-semibold text-ink-strong sm:text-[1.7rem]">
              Keep reading
            </h2>
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {relatedPosts.map((entry) => (
                <Link
                  key={entry.slug}
                  href={`/blog/${entry.slug}`}
                  className="group flex flex-col rounded-2xl border border-ink-base/10 bg-surface-card/90 p-5 transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-card-lift"
                >
                  <p className="eyebrow">{entry.category}</p>
                  <h3 className="mt-2 font-heading text-lg font-semibold leading-snug text-ink-strong group-hover:underline">
                    {entry.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-base/70">
                    {entry.description}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </article>
    </main>
  );
}
