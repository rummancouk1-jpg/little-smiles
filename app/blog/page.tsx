import Link from "next/link";

import { ProductImage } from "@/components/product-image";
import { categoryMatClass } from "@/components/product-grid";
import { Reveal } from "@/components/reveal";
import { getBlogAnchorProduct } from "@/lib/blog";
import { getAllBlogPosts } from "@/lib/blog-data";
import { breadcrumbJsonLdDocument } from "@/lib/json-ld";
import { getImageCandidates } from "@/lib/products";
import { staticPageMetadata } from "@/lib/seo-metadata";
import { cn } from "@/lib/utils";

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

/* ISR safety net — the publish action revalidates this page on demand;
   the hourly window only covers out-of-band DB changes. */
export const revalidate = 3600;

export default async function BlogPage() {
  const sortedPosts = await getAllBlogPosts();

  return (
    <main className="min-h-screen bg-surface-page pb-20 pt-10 sm:pt-12 lg:pt-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogIndexBreadcrumbLd) }}
      />
      <section className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">Little Smiles Journal</p>
          <h1 className="mt-4 text-balance text-headline font-semibold text-ink-strong">
            Parenting guides &amp; buying advice
          </h1>
          <p className="mt-4 text-pretty text-base leading-relaxed text-ink-base/70 sm:text-lg">
            Practical, premium-first advice for newborn essentials, feeding, and
            everyday baby comfort — written for parents shopping in Pakistan.
          </p>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-x-6 gap-y-10 sm:mt-14 sm:grid-cols-2 lg:grid-cols-3">
          {sortedPosts.map((post, index) => {
            const anchor = getBlogAnchorProduct(post);
            return (
              <Reveal
                as="article"
                key={post.slug}
                index={index}
                className="group flex h-full flex-col"
              >
                <Link
                  href={`/blog/${post.slug}`}
                  className="block rounded-t-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-walnut/30"
                >
                  {anchor ? (
                    <div
                      className={cn(
                        "arch-frame pb-6 pt-9 shadow-card-rest transition-[transform,box-shadow] duration-300 group-hover:-translate-y-1 group-hover:shadow-card-lift",
                        categoryMatClass[post.relatedProductCategory] ?? "bg-mat-butter",
                      )}
                    >
                      <div className="relative mx-auto aspect-square w-[62%]">
                        <ProductImage
                          sources={getImageCandidates(anchor.image)}
                          alt={`${post.category} guide — Little Smiles`}
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          className="object-contain object-center transition-transform duration-300 group-hover:scale-[1.02]"
                        />
                      </div>
                      <div aria-hidden className="arch-floor bottom-[5%] h-3 w-[50%]" />
                    </div>
                  ) : null}
                </Link>

                <span className="z-10 -mt-3 self-center rounded-full border border-dashed border-ink-base/30 bg-surface-raised px-3.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-base/70">
                  {post.category}
                </span>

                <h2 className="mt-3.5 text-center text-[1.35rem] font-semibold leading-tight text-ink-strong">
                  <Link
                    href={`/blog/${post.slug}`}
                    className="rounded-md hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-walnut/24"
                  >
                    {post.title}
                  </Link>
                </h2>
                <p className="mx-auto mt-2 max-w-[34ch] text-center text-sm leading-relaxed text-ink-base/68">
                  {post.description}
                </p>
                <p className="mt-3 text-center text-xs uppercase tracking-[0.12em] text-ink-base/52">
                  {post.readTime}
                </p>

                <div className="mt-auto flex justify-center pt-4">
                  <Link
                    href={`/blog/${post.slug}`}
                    className="group/read inline-flex items-center gap-1.5 text-sm font-medium text-ink-walnut underline decoration-dashed decoration-ink-base/28 underline-offset-[5px] transition-[color,text-decoration-color] duration-200 hover:decoration-ink-walnut/55"
                  >
                    Read the guide
                    <span
                      aria-hidden
                      className="transition-transform duration-200 group-hover/read:translate-x-0.5"
                    >
                      →
                    </span>
                  </Link>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>
    </main>
  );
}
