"use client";

import Link from "next/link";
import { type CSSProperties, type MouseEvent } from "react";
import { BadgeCheck, Feather, Sun } from "lucide-react";

import { PakistanServiceNotes } from "@/components/pakistan-service-notes";
import { ProductImage } from "@/components/product-image";
import { Button } from "@/components/ui/button";
import { getImageCandidates } from "@/lib/products";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";
import { cn } from "@/lib/utils";

const trustItems = [
  { label: "Soft to wear", icon: Feather },
  { label: "Made to last", icon: BadgeCheck },
  { label: "For daily use", icon: Sun },
] as const;

const collageCards = [
  {
    src: "/products/fly-high-swaddle.png",
    alt: "Little Smiles fly high swaddle",
    className:
      "col-span-7 row-span-7 -translate-y-1 scale-[1.01] -rotate-[1.6deg] bg-surface-panel/96 ring-ink-walnut/10",
    imageWrapClassName: "p-6 sm:p-7",
  },
  {
    src: "/products/dino-deer-bodysuits.png",
    alt: "Little Smiles dino and deer bodysuits",
    className:
      "col-span-5 row-span-4 -translate-y-2 -translate-x-2 scale-[1.02] rotate-[2.2deg] bg-atmosphere-mist/96 ring-ink-walnut/10",
    imageWrapClassName: "p-5 sm:p-6",
  },
  {
    src: "/products/blue-and-white-food-bag.png",
    alt: "Little Smiles blue and white food bag",
    className:
      "col-span-5 row-span-5 -translate-x-6 translate-y-2 scale-[0.98] rotate-[-1.4deg] bg-atmosphere-veil/95 ring-ink-walnut/10",
    imageWrapClassName: "p-4 sm:p-5",
  },
] as const;

function ProductCard({
  src,
  alt,
  className,
  imageWrapClassName,
  priority,
  delay,
  depthX,
  depthY,
}: {
  src: string;
  alt: string;
  className: string;
  imageWrapClassName?: string;
  priority?: boolean;
  delay: number;
  depthX: number;
  depthY: number;
}) {
  // Depth-layered parallax without framer: each card translates by the shared
  // pointer CSS variables (set on the collage container) scaled by its own
  // depth. The transition supplies the soft spring-like lag. At rest the vars
  // are 0, so the card is settled and paints immediately (no JS gate on LCP).
  const parallaxStyle: CSSProperties = {
    transform: `translate3d(calc(var(--parallax-x, 0) * ${depthX}px), calc(var(--parallax-y, 0) * ${depthY}px), 0)`,
    transition: "transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)",
  };

  return (
    <div
      className={cn(
        "relative h-full w-full overflow-hidden rounded-3xl ring-1 ring-inset",
        "shadow-[0_36px_78px_-34px_rgba(45,35,32,0.34)]",
        className
      )}
      style={parallaxStyle}
    >
      {/* Float via CSS so it auto-pauses when this hero is the hidden theme
          (display:none). Per-card timing preserved; disabled under
          reduced-motion by the media query. */}
      <div
        className={cn("hero-float relative h-full w-full", imageWrapClassName)}
        style={{
          animationDuration: `${11 + delay * 1.35}s`,
          animationDelay: `${0.35 + delay / 2}s`,
        }}
      >
        <ProductImage
          sources={getImageCandidates(src)}
          alt={alt}
          fill
          priority={priority}
          sizes="(max-width: 1024px) 45vw, 26vw"
          className="object-contain"
        />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_28%_16%,rgba(255,255,255,0.72),transparent_58%)]" />
    </div>
  );
}

export function HeroSection() {
  const reduce = usePrefersReducedMotion();

  // Vanilla pointer parallax: write normalized -1..1 offsets to CSS variables on
  // the collage container; the cards read them. Desktop pointer only — mobile
  // never fires this, so it costs nothing on the tested path. No framer.
  const handleCollagePointerMove = (event: MouseEvent<HTMLDivElement>) => {
    if (reduce) return;
    const el = event.currentTarget;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--parallax-x", String(((event.clientX - rect.left) / rect.width - 0.5) * 2));
    el.style.setProperty("--parallax-y", String(((event.clientY - rect.top) / rect.height - 0.5) * 2));
  };

  const handleCollagePointerLeave = (event: MouseEvent<HTMLDivElement>) => {
    event.currentTarget.style.setProperty("--parallax-x", "0");
    event.currentTarget.style.setProperty("--parallax-y", "0");
  };

  return (
    <section className="relative overflow-hidden bg-transparent">
      {/* Living Cream: soft blush + brass + cream clouds drifting slowly behind
          everything — what makes the flat cream feel alive and luminous. Fully
          static under reduced-motion (the drift is CSS, gated by media query). */}
      <div
        className="living-clouds-in pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden
      >
        <div className="living-cloud living-cloud-blush living-drift-a absolute -left-[12%] top-[-10%] h-[42vh] max-h-[460px] w-[42vh] max-w-[460px] blur-2xl sm:blur-3xl" />
        <div className="living-cloud living-cloud-brass living-drift-b absolute -right-[8%] top-[8%] h-[38vh] max-h-[430px] w-[38vh] max-w-[430px] blur-2xl sm:blur-3xl" />
        <div className="living-cloud living-cloud-cream living-drift-c absolute -bottom-[12%] left-[26%] h-[36vh] max-h-[400px] w-[36vh] max-w-[400px] blur-2xl sm:blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 pb-12 pt-6 sm:px-6 sm:pb-18 sm:pt-9 lg:px-8 lg:pb-24 lg:pt-12">
        <div className="grid items-center gap-6 sm:gap-9 lg:grid-cols-2 lg:gap-14 xl:gap-18">
          <div className="max-w-xl lg:max-w-none">
            {/* Supporting text uses the CSS hero-rise entrance (runs at paint,
                no framer). The <h1> is intentionally exempt: it's the LCP and
                must paint instantly, so it carries no entrance animation. */}
            <p className="hero-rise eyebrow" style={{ animationDelay: "0.04s" }}>
              Little Smiles
            </p>

            <h1 className="mt-3 text-balance text-display font-medium text-ink-strong sm:mt-4">
              Tiny Essentials for Your Little <span className="italic">Smiles</span>
            </h1>

            <p
              className="hero-rise mt-4 max-w-[38ch] text-pretty text-base leading-relaxed text-ink-base/70 sm:mt-6 sm:text-xl"
              style={{ animationDelay: "0.12s" }}
            >
              Considered fabrics. Calm prints. Made for the routines that grow
              with your baby.
            </p>

            <div
              className="hero-rise mt-7 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:flex-wrap sm:items-center sm:gap-6"
              style={{ animationDelay: "0.2s" }}
            >
              <Button
                asChild
                size="lg"
                className="h-12 w-full rounded-full border-transparent bg-accent-brass px-9 text-base font-medium text-accent-brass-ink shadow-cta transition-[transform,box-shadow,background-color] duration-300 hover:-translate-y-0.5 hover:bg-accent-brass/90 [a]:hover:bg-accent-brass/90 hover:shadow-cta-hover sm:w-auto"
              >
                <Link href="/shop">Shop Collection</Link>
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

            <ul
              className="hero-rise mt-8 flex flex-wrap gap-2.5 sm:mt-12 sm:gap-4"
              style={{ animationDelay: "0.28s" }}
            >
              {trustItems.map(({ label, icon: Icon }) => (
                <li
                  key={label}
                  className="inline-flex items-center gap-2.5 rounded-2xl border border-ink-base/8 bg-surface-raised/68 px-4 py-2.5 text-sm font-medium text-ink-base/80 shadow-[0_8px_30px_-18px_rgba(59,47,47,0.2)] backdrop-blur-sm"
                >
                  <span className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-atmosphere-veil to-atmosphere-haze text-ink-base/70 ring-1 ring-ink-base/7">
                    <Icon className="size-4" strokeWidth={1.75} aria-hidden />
                  </span>
                  {label}
                </li>
              ))}
            </ul>
            <div className="hero-rise" style={{ animationDelay: "0.34s" }}>
              <PakistanServiceNotes variant="hero" />
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[30rem] lg:mx-0 lg:max-w-xl">
            <div
              className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_48%,rgba(245,239,233,0.88),rgba(249,245,241,0.14)_70%)] blur-[4px]"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute -left-10 -top-8 h-32 w-32 rounded-full bg-atmosphere-haze/72 blur-2xl sm:h-36 sm:w-36"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute -right-8 bottom-5 h-28 w-28 rounded-full bg-atmosphere-shade/72 blur-2xl sm:h-36 sm:w-36"
              aria-hidden
            />
            <div
              className="relative grid min-h-[320px] grid-cols-10 grid-rows-10 gap-2.5 sm:min-h-[430px] sm:gap-4 lg:min-h-[540px]"
              onMouseMove={handleCollagePointerMove}
              onMouseLeave={handleCollagePointerLeave}
            >
              <ProductCard
                src={collageCards[0].src}
                alt={collageCards[0].alt}
                className={cn(collageCards[0].className, "z-[3] luxe-sheen")}
                imageWrapClassName={collageCards[0].imageWrapClassName}
                priority
                delay={0.12}
                depthX={-9}
                depthY={-8}
              />
              <ProductCard
                src={collageCards[1].src}
                alt={collageCards[1].alt}
                className={cn(collageCards[1].className, "z-[5] luxe-sheen")}
                imageWrapClassName={collageCards[1].imageWrapClassName}
                delay={0.2}
                depthX={24}
                depthY={20}
              />
              <ProductCard
                src={collageCards[2].src}
                alt={collageCards[2].alt}
                className={cn(collageCards[2].className, "z-[4] luxe-sheen")}
                imageWrapClassName={collageCards[2].imageWrapClassName}
                delay={0.28}
                depthX={-15}
                depthY={13}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
