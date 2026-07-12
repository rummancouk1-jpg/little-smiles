import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { breadcrumbJsonLdDocument } from "@/lib/json-ld";
import { whatsappBaseUrl } from "@/lib/products";
import { customerReviews } from "@/lib/reviews";
import { staticPageMetadata } from "@/lib/seo-metadata";

export const metadata = staticPageMetadata({
  title: "Reviews — Real Families, Real Words",
  description:
    "Little Smiles is a new Pakistani baby boutique. Every review on this page is real — sent by a customer about a genuine order. Be one of our first families.",
  path: "/reviews",
});

const reviewsBreadcrumbLd = breadcrumbJsonLdDocument([
  { name: "Home", path: "/" },
  { name: "Reviews", path: "/reviews" },
]);

const shareHref = `${whatsappBaseUrl}?text=${encodeURIComponent(
  "Hi Little Smiles, I ordered from you and would love to share my honest review.",
)}`;

/** How a review happens — an honest, concrete path (not a form, WhatsApp). */
const steps = [
  {
    title: "Order",
    body: "Pick something from the shop — cash on delivery, anywhere in Pakistan.",
  },
  {
    title: "Live with it",
    body: "Wash it, pack it, use it on the hard days. That's the review that matters.",
  },
  {
    title: "Tell us honestly",
    body: "Send a few words (and a photo if you like) on WhatsApp. With your permission, it goes here — verbatim.",
  },
] as const;

export default function ReviewsPage() {
  const hasReviews = customerReviews.length > 0;

  return (
    <main className="min-h-screen bg-surface-page pb-20 pt-10 sm:pb-24 sm:pt-12 lg:pt-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(reviewsBreadcrumbLd) }}
      />
      <section className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">Little Smiles</p>
          <h1 className="mt-4 text-headline font-semibold text-ink-strong">
            {hasReviews ? "Real families, real words" : "Be one of our first families"}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-ink-base/70 sm:text-lg">
            We&apos;re a new Pakistani boutique, and we made ourselves one rule:
            every review on this page is real — a customer&apos;s own words about
            a genuine order. Nothing invented, nothing polished up.
          </p>
        </div>

        {hasReviews ? (
          <>
            {/* Photo stories — only reviews where the customer sent a photo. */}
            {customerReviews.some((r) => r.photo) ? (
              <div className="mt-12 sm:mt-14">
                <h2 className="text-center text-xs font-medium uppercase tracking-[0.22em] text-ink-base/50">
                  In photos
                </h2>
                <div className="mobile-rail mt-6 flex snap-x gap-4 overflow-x-auto pb-1 sm:grid sm:grid-cols-2 sm:gap-5 sm:overflow-visible lg:grid-cols-4">
                  {customerReviews
                    .filter((r) => r.photo)
                    .map((review) => (
                      <article
                        key={review.id}
                        className="min-w-[84%] snap-start text-center sm:min-w-0"
                      >
                        <div className="arch-frame bg-mat-blush">
                          <div className="relative aspect-square">
                            <Image
                              src={review.photo as string}
                              alt={`Photo sent by ${review.author}`}
                              fill
                              sizes="(max-width: 640px) 84vw, (max-width: 1024px) 50vw, 25vw"
                              className="object-cover object-center"
                            />
                          </div>
                        </div>
                        <div className="space-y-2 px-2 pt-4">
                          <p className="font-heading text-lg italic leading-snug text-ink-strong">
                            &ldquo;{review.quote}&rdquo;
                          </p>
                          <p className="text-xs font-medium uppercase tracking-[0.12em] text-ink-base/58">
                            {review.author}
                            {review.location ? ` — ${review.location}` : null}
                          </p>
                        </div>
                      </article>
                    ))}
                </div>
              </div>
            ) : null}

            {/* Written reviews — every review, verbatim. */}
            <div className="mt-14 sm:mt-16">
              <h2 className="text-center text-xs font-medium uppercase tracking-[0.22em] text-ink-base/50">
                In their words
              </h2>
              <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:gap-5">
                {customerReviews.map((review) => (
                  <article
                    key={review.id}
                    className="rounded-3xl border border-dashed border-ink-base/25 bg-surface-card/94 p-6"
                  >
                    <p className="text-sm leading-relaxed text-ink-base/78 sm:text-[0.9375rem]">
                      &ldquo;{review.quote}&rdquo;
                    </p>
                    <p className="mt-4 text-xs font-medium uppercase tracking-[0.12em] text-ink-base/58">
                      {review.author}
                      {review.location ? ` — ${review.location}` : null}
                      {review.product ? ` · ${review.product}` : null}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </>
        ) : (
          /* Honest early state: the shelf is built, waiting for its first
             real stories — an invitation, not fabricated praise. */
          <div className="mx-auto mt-12 max-w-3xl sm:mt-14">
            <ol className="grid gap-4 sm:grid-cols-3 sm:gap-5">
              {steps.map((step, index) => (
                <li
                  key={step.title}
                  className="rounded-3xl border border-dashed border-ink-base/28 bg-surface-raised/60 p-5 text-center"
                >
                  <span className="mx-auto flex size-9 items-center justify-center rounded-full bg-accent-marigold font-heading text-base font-semibold text-accent-marigold-ink">
                    {index + 1}
                  </span>
                  <p className="mt-3 font-heading text-xl font-semibold text-ink-strong">
                    {step.title}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-ink-base/68">
                    {step.body}
                  </p>
                </li>
              ))}
            </ol>

            <p className="mx-auto mt-10 max-w-md text-center text-sm leading-relaxed text-ink-base/62">
              The first reviews a new shop shows you say everything about it.
              Ours will be here soon — real ones.
            </p>
          </div>
        )}

        <div className="mx-auto mt-12 flex max-w-lg flex-col items-center gap-4 sm:mt-14">
          <Button
            asChild
            className="h-12 w-full rounded-full bg-accent-marigold px-8 text-sm font-semibold text-accent-marigold-ink shadow-cta hover:bg-accent-marigold-deep [a]:hover:bg-accent-marigold-deep sm:w-auto"
          >
            <Link href="/shop">Shop the collection</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="h-11 w-full rounded-full border-dashed border-ink-base/35 bg-transparent px-8 text-sm font-medium text-ink-walnut shadow-none sm:w-auto"
          >
            <Link href={shareHref} target="_blank" rel="noreferrer">
              Ordered already? Share your honest review
            </Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
