"use client";

import Link from "next/link";
import { useState, type MouseEvent } from "react";
import { useReducedMotion } from "motion/react";

import { ProductImage } from "@/components/product-image";
import { Button } from "@/components/ui/button";
import { getImageCandidates } from "@/lib/products";

/**
 * Dark-mode "Spotlight" hero: one bestseller product lit by a single pool of
 * brass glow against the warm dark ground. Renders only in dark mode (the home
 * page hides it in light). Motion is slow/cinematic and fully disabled under
 * prefers-reduced-motion (users then get the static spotlit composition).
 *
 * The keepsake bestseller (fly-high-swaddle) for continuity with Move 1.
 */
const HERO_SRC = "/products/dino-deer-bodysuits.png";
const HERO_ALT = "Little Smiles dino and deer bodysuits";
const HERO_SLUG = "dino-deer-bodysuits";

export function HeroSpotlight() {
  const reduce = useReducedMotion();
  const [pointer, setPointer] = useState({ x: 0, y: 0 });

  const handleMove = (event: MouseEvent<HTMLElement>) => {
    if (reduce) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    setPointer({ x, y });
  };

  const handleLeave = () => {
    if (reduce) return;
    setPointer({ x: 0, y: 0 });
  };

  // Product drifts with the cursor; the glow drifts gently the other way for depth.
  const productShift = reduce
    ? undefined
    : { transform: `translate3d(${pointer.x * 16}px, ${pointer.y * 14}px, 0)` };
  const glowShift = reduce
    ? undefined
    : { transform: `translate3d(${pointer.x * -7}px, ${pointer.y * -6}px, 0)` };

  return (
    <section
      className="relative overflow-hidden"
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
    >
      <div className="relative mx-auto max-w-7xl px-4 pb-14 pt-8 sm:px-6 sm:pb-20 sm:pt-12 lg:px-8 lg:pb-28 lg:pt-16">
        <div className="grid items-center gap-8 sm:gap-10 lg:grid-cols-2 lg:gap-14">
          {/* Spotlit product — top on mobile, right on desktop */}
          <div className="relative order-1 min-h-[19rem] sm:min-h-[24rem] lg:order-2 lg:min-h-[30rem]">
            {/* the pooled brass glow behind the product */}
            <div
              className="spotlight-parallax pointer-events-none absolute inset-0 z-0"
              style={glowShift}
              aria-hidden
            >
              <div className="spotlight-glow-in absolute inset-[-18%] flex items-center justify-center">
                <div className="spotlight-glow spotlight-breathe h-[130%] w-[130%] rounded-full blur-2xl sm:blur-3xl" />
              </div>
            </div>
            {/* the product itself */}
            <div className="spotlight-parallax relative z-10" style={productShift}>
              <Link
                href={`/shop/${HERO_SLUG}`}
                aria-label={`View ${HERO_ALT}`}
                className="spotlight-settle relative mx-auto block aspect-square w-full max-w-[19rem] rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brass/40 sm:max-w-[24rem] lg:max-w-[30rem]"
              >
                <ProductImage
                  sources={getImageCandidates(HERO_SRC)}
                  alt={HERO_ALT}
                  fill
                  priority
                  sizes="(max-width: 1024px) 80vw, 40vw"
                  className="object-contain"
                />
              </Link>
            </div>
          </div>

          {/* Headline + CTA — below on mobile, left (in the dark) on desktop */}
          <div className="spotlight-settle-late order-2 max-w-xl lg:order-1 lg:max-w-none">
            <p className="eyebrow">Little Smiles</p>
            <h1 className="mt-3 text-balance text-display font-medium text-ink-strong sm:mt-4">
              Tiny Essentials for Your Little <span className="italic">Smiles</span>
            </h1>
            <p className="mt-4 max-w-[38ch] text-pretty text-base leading-relaxed text-ink-base/72 sm:mt-6 sm:text-xl">
              Considered fabrics. Calm prints. Made for the routines that grow
              with your baby.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:flex-wrap sm:items-center sm:gap-6">
              <Button
                asChild
                size="lg"
                className="h-12 w-full rounded-full border-transparent bg-accent-brass px-9 text-base font-medium text-accent-brass-ink shadow-[0_18px_50px_-18px_rgba(201,154,82,0.6)] transition-[transform,box-shadow,background-color] duration-300 hover:-translate-y-0.5 hover:bg-accent-brass/90 [a]:hover:bg-accent-brass/90 sm:w-auto"
              >
                <Link href="/shop">Shop Collection</Link>
              </Button>
              <Link
                href="/best-sellers"
                className="group inline-flex items-center gap-2 self-center text-base font-medium text-ink-strong/85 underline decoration-ink-base/25 underline-offset-[8px] transition-[color,text-decoration-color] duration-300 hover:text-ink-strong hover:decoration-ink-strong/50 sm:self-auto"
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
          </div>
        </div>
      </div>
    </section>
  );
}
