import Link from "next/link";

import { PakistanServiceNotes } from "@/components/pakistan-service-notes";
import { ProductImage } from "@/components/product-image";
import { Button } from "@/components/ui/button";
import { getImageCandidates } from "@/lib/products";

/**
 * Golden Hour hero — the Stage A proof of the direction.
 *
 * One hero for BOTH themes (the token spine inverts it: paper ground by day,
 * nightlight nursery by dark). Replaces the old theme-split pair (light
 * collage + dark Spotlight) and their ambient loops. Server component — no
 * framer, no pointer springs; the only motion is the one-shot arch-rise,
 * disabled under prefers-reduced-motion via globals.css.
 */
const HERO_SRC = "/products/dino-deer-bodysuits.png";
const HERO_ALT =
  "Dino Deer bodysuits — red striped and blue dinosaur prints";

const trustNotes = [
  "Cash on delivery",
  "WhatsApp ordering",
  "Ships nationwide",
] as const;

/** Marigold smile-arc drawn under the brand word — the literal signature. */
function SmileArc() {
  return (
    <svg
      viewBox="0 0 100 12"
      preserveAspectRatio="none"
      aria-hidden
      className="absolute -bottom-2 left-[6%] h-2.5 w-[88%] sm:-bottom-3 sm:h-3"
    >
      <path
        d="M2 2 Q50 14 98 2"
        pathLength={1}
        fill="none"
        stroke="var(--accent-marigold)"
        strokeWidth="3"
        strokeLinecap="round"
        className="smile-arc-draw"
      />
    </svg>
  );
}

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-transparent">
      <div className="relative mx-auto max-w-7xl px-4 pb-12 pt-8 sm:px-6 sm:pb-18 sm:pt-10 lg:px-8 lg:pb-24 lg:pt-14">
        <div className="grid items-center gap-8 sm:gap-10 lg:grid-cols-2 lg:gap-14 xl:gap-18">
          <div className="arch-rise max-w-xl lg:max-w-none">
            <p className="eyebrow">Little Smiles</p>

            <h1 className="mt-3 text-balance text-display font-semibold text-ink-strong sm:mt-4">
              Tiny Essentials for Your Little{" "}
              <span className="relative inline-block">
                Smiles
                <SmileArc />
              </span>
            </h1>

            <p className="mt-5 max-w-[36ch] text-pretty text-base leading-relaxed text-ink-base/72 sm:mt-7 sm:text-xl">
              Soft, cheerful pieces for naps, feeds and first outings — made
              for everyday Pakistan routines.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:mt-9 sm:flex-row sm:flex-wrap sm:items-center sm:gap-6">
              <Button
                asChild
                size="lg"
                className="h-13 w-full rounded-full border-transparent bg-accent-marigold px-9 text-base font-semibold text-accent-marigold-ink shadow-cta transition-[transform,box-shadow,background-color] duration-300 hover:-translate-y-0.5 hover:bg-accent-marigold-deep [a]:hover:bg-accent-marigold-deep hover:shadow-cta-hover sm:w-auto"
              >
                <Link href="/shop">Shop the collection</Link>
              </Button>
              <Link
                href="/best-sellers"
                className="group inline-flex items-center gap-2 self-center text-base font-medium text-ink-strong/85 underline decoration-ink-base/22 underline-offset-[8px] transition-[color,text-decoration-color] duration-300 hover:text-ink-strong hover:decoration-ink-espresso/50 sm:self-auto"
              >
                View best sellers
                <span
                  aria-hidden
                  className="text-[0.9em] leading-none transition-transform duration-300 group-hover:translate-x-0.5"
                >
                  →
                </span>
              </Link>
            </div>

            {/* Stitched trust chips — dashed hairlines echo fabric stitching. */}
            <ul className="mt-8 flex flex-wrap gap-2.5 sm:mt-10 sm:gap-3">
              {trustNotes.map((label) => (
                <li
                  key={label}
                  className="inline-flex items-center gap-2 rounded-full border border-dashed border-ink-base/30 px-3.5 py-2 text-[0.8125rem] font-medium text-ink-base/78"
                >
                  <span aria-hidden className="text-sm leading-none text-tone-trust">
                    ✓
                  </span>
                  {label}
                </li>
              ))}
            </ul>

            <PakistanServiceNotes variant="hero" className="mt-6" />
          </div>

          {/* The arch window: bestseller seated on a sky mat, grounded by its
              contact shadow — nursery window / album frame / smile. */}
          <div className="arch-rise-late relative mx-auto w-full max-w-[26rem] lg:mx-0 lg:max-w-[30rem]">
            <Link
              href="/shop/dino-deer-bodysuits"
              aria-label="View the Dino Deer bodysuits"
              className="arch-frame block bg-mat-butter pb-9 pt-12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-walnut/30 sm:pb-11 sm:pt-16"
            >
              <div className="relative mx-auto aspect-square w-[72%]">
                <ProductImage
                  sources={getImageCandidates(HERO_SRC)}
                  alt={HERO_ALT}
                  fill
                  priority
                  sizes="(max-width: 1024px) 72vw, 24rem"
                  className="object-contain"
                />
              </div>
              <div
                aria-hidden
                className="arch-floor bottom-[6%] h-4 w-[58%] sm:h-5"
              />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
