import Link from "next/link";
import { Reveal } from "@/components/reveal";
import { Button } from "@/components/ui/button";
import { whatsappBaseUrl } from "@/lib/products";
import { customerReviews } from "@/lib/reviews";

/**
 * Honest early-store section. We are a new boutique with no reviews yet —
 * so this section says exactly that, warmly, instead of showing invented
 * customers. Once real reviews exist in lib/reviews.ts the lead quote
 * below switches to the newest real one, verbatim.
 */
export function TestimonialsSection() {
  const latest = customerReviews[0];

  const shareHref = `${whatsappBaseUrl}?text=${encodeURIComponent(
    "Hi Little Smiles, I ordered from you and would love to share my honest review.",
  )}`;

  return (
    // Paper chapter between the two warm bands.
    <section className="relative bg-transparent pb-20 pt-14 sm:pb-24 sm:pt-16 lg:pb-28 lg:pt-18">
      <div className="relative mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">Letters</p>
          <h2 className="mt-4 text-balance text-headline font-semibold text-ink-espresso">
            {latest
              ? "From families across Pakistan"
              : "Your family could be our first story"}
          </h2>
          {latest ? (
            <blockquote className="mx-auto mt-8 max-w-xl">
              <p className="font-heading text-2xl italic leading-[1.3] text-ink-strong sm:text-[1.7rem]">
                &ldquo;{latest.quote}&rdquo;
              </p>
              <cite className="mt-4 block text-xs font-medium uppercase not-italic tracking-[0.12em] text-ink-base/58">
                {latest.author}
                {latest.location ? ` — ${latest.location}` : null}
              </cite>
            </blockquote>
          ) : (
            <p className="mt-5 text-pretty text-base leading-relaxed text-ink-base/68 sm:text-lg">
              We&apos;re a new boutique, and this space is reserved for real
              words from real orders — never invented ones. Order something,
              live with it, and tell us honestly how it went.
            </p>
          )}
        </Reveal>

        <Reveal className="mt-9 flex flex-col items-center gap-3 sm:mt-10 sm:flex-row sm:justify-center sm:gap-4">
          <Button
            asChild
            className="h-12 w-full rounded-full bg-accent-marigold px-8 text-sm font-semibold text-accent-marigold-ink shadow-cta transition-[transform,box-shadow,background-color] duration-300 hover:-translate-y-0.5 hover:bg-accent-marigold-deep [a]:hover:bg-accent-marigold-deep sm:w-auto"
          >
            <Link href="/shop">Shop the collection</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="h-11 w-full rounded-full border-dashed border-ink-base/35 bg-transparent px-7 text-sm font-medium text-ink-walnut shadow-none transition-[transform,background-color] duration-300 hover:-translate-y-0.5 hover:bg-surface-hover sm:w-auto"
          >
            <Link href={shareHref} target="_blank" rel="noreferrer">
              Ordered already? Tell us honestly
            </Link>
          </Button>
        </Reveal>

        <p className="mt-6 text-center text-sm text-ink-base/58">
          <Link
            href="/reviews"
            className="font-medium text-ink-walnut underline decoration-dashed decoration-ink-base/28 underline-offset-4 transition-colors hover:decoration-ink-walnut/50"
          >
            How reviews work here
          </Link>
        </p>
      </div>
    </section>
  );
}
