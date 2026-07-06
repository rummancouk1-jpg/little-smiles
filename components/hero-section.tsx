"use client";

import Link from "next/link";
import { useState, type MouseEvent } from "react";
import { motion, useReducedMotion } from "motion/react";
import { BadgeCheck, Feather, Sun } from "lucide-react";

import { motionDuration, motionStagger, premiumEase } from "@/lib/motion";
import { PakistanServiceNotes } from "@/components/pakistan-service-notes";
import { ProductImage } from "@/components/product-image";
import { Button } from "@/components/ui/button";
import { getImageCandidates } from "@/lib/products";
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
  parallaxX = 0,
  parallaxY = 0,
}: {
  src: string;
  alt: string;
  className: string;
  imageWrapClassName?: string;
  priority?: boolean;
  delay: number;
  parallaxX?: number;
  parallaxY?: number;
}) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: reduce ? 0 : motionDuration.slow,
        delay: reduce ? 0 : delay,
        ease: premiumEase,
      }}
      className={cn(
        "relative h-full w-full overflow-hidden rounded-3xl ring-1 ring-inset",
        "shadow-[0_36px_78px_-34px_rgba(45,35,32,0.34)]",
        className
      )}
      style={{ x: parallaxX, y: parallaxY }}
    >
      <motion.div
        animate={reduce ? { y: 0 } : { y: [0, -3, 0] }}
        transition={
          reduce
            ? { duration: 0 }
            : {
                duration: 11 + delay * 1.35,
                delay: 0.35 + delay / 2,
                repeat: Infinity,
                ease: "easeInOut",
              }
        }
        className={cn("relative h-full w-full", imageWrapClassName)}
      >
        <ProductImage
          sources={getImageCandidates(src)}
          alt={alt}
          fill
          priority={priority}
          sizes="(max-width: 1024px) 45vw, 26vw"
          className="object-contain"
        />
      </motion.div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_28%_16%,rgba(255,255,255,0.72),transparent_58%)]" />
    </motion.div>
  );
}

export function HeroSection() {
  const reduce = useReducedMotion();
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const baseTransition = {
    duration: reduce ? 0 : motionDuration.slow,
    ease: premiumEase,
  };
  const stagger = reduce ? 0 : motionStagger;

  const handleCollagePointerMove = (event: MouseEvent<HTMLDivElement>) => {
    if (reduce) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    setParallax({ x, y });
  };

  const handleCollagePointerLeave = () => {
    if (reduce) return;
    setParallax({ x: 0, y: 0 });
  };

  return (
    <section className="relative overflow-hidden bg-transparent">
      <div className="pointer-events-none absolute inset-0 opacity-[0.48]" aria-hidden>
        <div className="absolute -left-32 top-0 h-[420px] w-[420px] rounded-full bg-atmosphere-mist/72 blur-3xl" />
        <div className="absolute -right-24 top-24 h-[380px] w-[380px] rounded-full bg-atmosphere-haze/64 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-[280px] w-[280px] rounded-full bg-atmosphere-veil/70 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 pb-12 pt-6 sm:px-6 sm:pb-18 sm:pt-9 lg:px-8 lg:pb-24 lg:pt-12">
        <div className="grid items-center gap-6 sm:gap-9 lg:grid-cols-2 lg:gap-14 xl:gap-18">
          <motion.div
            initial={reduce ? false : "hidden"}
            animate="visible"
            variants={{
              hidden: {},
              visible: {
                transition: { staggerChildren: stagger, delayChildren: 0.04 },
              },
            }}
            className="max-w-xl lg:max-w-none"
          >
            <motion.p
              variants={{
                hidden: { opacity: 0, y: reduce ? 0 : 12 },
                visible: { opacity: 1, y: 0, transition: baseTransition },
              }}
              className="eyebrow"
            >
              Little Smiles
            </motion.p>

            <motion.h1
              variants={{
                hidden: { opacity: 0, y: reduce ? 0 : 12 },
                visible: { opacity: 1, y: 0, transition: baseTransition },
              }}
              className="mt-3 text-balance text-display font-medium text-ink-strong sm:mt-4"
            >
              Tiny Essentials for Your Little{" "}
              <span className="italic">Smiles</span>
            </motion.h1>

            <motion.p
              variants={{
                hidden: { opacity: 0, y: reduce ? 0 : 12 },
                visible: { opacity: 1, y: 0, transition: baseTransition },
              }}
              className="mt-4 max-w-[38ch] text-pretty text-base leading-relaxed text-ink-base/70 sm:mt-6 sm:text-xl"
            >
              Considered fabrics. Calm prints. Made for the routines that grow
              with your baby.
            </motion.p>

            <motion.div
              variants={{
                hidden: { opacity: 0, y: reduce ? 0 : 12 },
                visible: { opacity: 1, y: 0, transition: baseTransition },
              }}
              className="mt-7 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:flex-wrap sm:items-center sm:gap-6"
            >
              <Button
                asChild
                size="lg"
                className="h-12 w-full rounded-full border-transparent bg-accent-brass px-9 text-base font-medium text-accent-brass-ink shadow-cta transition-[transform,box-shadow,background-color] duration-300 hover:-translate-y-0.5 hover:bg-accent-brass/90 hover:shadow-cta-hover sm:w-auto"
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
            </motion.div>

            <motion.ul
              variants={{
                hidden: { opacity: 0, y: reduce ? 0 : 10 },
                visible: { opacity: 1, y: 0, transition: baseTransition },
              }}
              className="mt-8 flex flex-wrap gap-2.5 sm:mt-12 sm:gap-4"
            >
              {trustItems.map(({ label, icon: Icon }) => (
                <li
                  key={label}
                  className="inline-flex items-center gap-2.5 rounded-2xl border border-ink-base/8 bg-white/68 px-4 py-2.5 text-sm font-medium text-ink-base/80 shadow-[0_8px_30px_-18px_rgba(59,47,47,0.2)] backdrop-blur-sm"
                >
                  <span className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-atmosphere-veil to-atmosphere-haze text-ink-base/70 ring-1 ring-ink-base/7">
                    <Icon className="size-4" strokeWidth={1.75} aria-hidden />
                  </span>
                  {label}
                </li>
              ))}
            </motion.ul>
            <motion.div
              variants={{
                hidden: { opacity: 0, y: reduce ? 0 : 10 },
                visible: { opacity: 1, y: 0, transition: baseTransition },
              }}
            >
              <PakistanServiceNotes variant="hero" />
            </motion.div>
          </motion.div>

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
                parallaxX={reduce ? 0 : parallax.x * -2.7}
                parallaxY={reduce ? 0 : parallax.y * -3}
              />
              <ProductCard
                src={collageCards[1].src}
                alt={collageCards[1].alt}
                className={cn(collageCards[1].className, "z-[5] luxe-sheen")}
                imageWrapClassName={collageCards[1].imageWrapClassName}
                delay={0.2}
                parallaxX={reduce ? 0 : parallax.x * 2.6}
                parallaxY={reduce ? 0 : parallax.y * 2.9}
              />
              <ProductCard
                src={collageCards[2].src}
                alt={collageCards[2].alt}
                className={cn(collageCards[2].className, "z-[4] luxe-sheen")}
                imageWrapClassName={collageCards[2].imageWrapClassName}
                delay={0.28}
                parallaxX={reduce ? 0 : parallax.x * -1.9}
                parallaxY={reduce ? 0 : parallax.y * 2.2}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
