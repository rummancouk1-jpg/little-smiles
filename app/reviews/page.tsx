import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { breadcrumbJsonLdDocument } from "@/lib/json-ld";
import { whatsappBaseUrl } from "@/lib/products";
import { staticPageMetadata } from "@/lib/seo-metadata";
import {
  homepageTestimonials,
  textReviewSnippets,
} from "@/lib/testimonials";

export const metadata = staticPageMetadata({
  title: "Customer Reviews & Parent Stories",
  description:
    "See Little Smiles reviews from families across Pakistan—photo testimonials and written feedback on swaddles, bodysuits, feeding gear, and delivery.",
  path: "/reviews",
});

const reviewsBreadcrumbLd = breadcrumbJsonLdDocument([
  { name: "Home", path: "/" },
  { name: "Reviews", path: "/reviews" },
]);

export default function ReviewsPage() {
  return (
    <main className="min-h-screen bg-surface-page pb-20 pt-10 sm:pb-24 sm:pt-12 lg:pt-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(reviewsBreadcrumbLd) }}
      />
      <section className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-ink-base/50">
            Trusted By Parents
          </p>
          <h1 className="mt-4 text-headline font-semibold text-ink-walnut">
            Customer Reviews
          </h1>
          <p className="mt-4 text-base leading-relaxed text-ink-base/70 sm:text-lg">
            Photo stories from our community, plus written notes from families
            across Pakistan—no repeated stock shots, just honest detail.
          </p>
        </div>

        <div className="mt-12 sm:mt-14">
          <h2 className="text-center text-xs font-medium uppercase tracking-[0.22em] text-ink-base/50">
            In photos
          </h2>
          <div className="mobile-rail mt-6 flex snap-x gap-4 overflow-x-auto pb-1 sm:grid sm:grid-cols-2 sm:gap-5 sm:overflow-visible lg:grid-cols-4">
            {homepageTestimonials.map((item) => (
              <article
                key={item.id}
                className="min-w-[84%] snap-start overflow-hidden rounded-3xl border border-ink-base/9 bg-surface-panel/95 shadow-[0_26px_58px_-36px_rgba(59,47,47,0.4)] sm:min-w-0"
              >
                <div className="relative aspect-square overflow-hidden bg-atmosphere-mist">
                  <Image
                    src={item.image}
                    alt={`Customer photo — ${item.author}`}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    className="object-cover object-center"
                  />
                </div>
                <div className="space-y-3 px-4 pb-5 pt-4">
                  <p className="text-sm leading-relaxed text-ink-base/74">
                    &ldquo;{item.quote}&rdquo;
                  </p>
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-ink-base/58">
                    {item.author} — {item.location}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-14 sm:mt-16">
          <h2 className="text-center text-xs font-medium uppercase tracking-[0.22em] text-ink-base/50">
            Written reviews
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-sm leading-relaxed text-ink-base/65">
            City-by-city feedback on orders, fabrics, and delivery—ideal when
            you want specifics without extra photography.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:gap-5">
            {textReviewSnippets.map((item) => (
              <article
                key={item.id}
                className="rounded-3xl border border-ink-base/9 bg-surface-card/94 p-6 shadow-[0_22px_48px_-32px_rgba(59,47,47,0.38)]"
              >
                <p className="text-sm leading-relaxed text-ink-base/78 sm:text-[0.9375rem]">
                  &ldquo;{item.quote}&rdquo;
                </p>
                <p className="mt-4 text-xs font-medium uppercase tracking-[0.12em] text-ink-base/58">
                  {item.author} — {item.location}
                </p>
              </article>
            ))}
          </div>
        </div>

        <div className="mx-auto mt-14 flex max-w-lg flex-col items-center gap-4 sm:mt-16">
          <Button
            asChild
            className="h-11 w-full rounded-full bg-accent-marigold px-8 text-sm font-medium text-accent-marigold-ink hover:bg-accent-marigold/90 [a]:hover:bg-accent-marigold/90 sm:w-auto"
          >
            <Link href="/shop">Shop essentials</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="h-11 w-full rounded-full border-ink-base/18 bg-surface-raised/70 px-8 text-sm font-medium text-ink-walnut sm:w-auto"
          >
            <Link
              href={`${whatsappBaseUrl}?text=${encodeURIComponent(
                "Hi Little Smiles, I would love to share my review."
              )}`}
              target="_blank"
              rel="noreferrer"
            >
              Share your review on WhatsApp
            </Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
