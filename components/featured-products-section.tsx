"use client";

import { motion, useReducedMotion } from "motion/react";

import { motionDuration, premiumEase } from "@/lib/motion";
import { ProductGrid } from "@/components/product-grid";
import { getFeaturedProducts } from "@/lib/products";

export function FeaturedProductsSection() {
  const reduce = useReducedMotion();
  const products = getFeaturedProducts();
  // Keepsake tier: the lead featured product that is also a bestseller
  // (first featured otherwise). Wired off the existing catalog flags — no
  // new data. Currently resolves to "fly-high-swaddle".
  const keepsakeSlug =
    products.find((p) => p.bestSeller)?.slug ?? products[0]?.slug;

  return (
    <section className="relative overflow-hidden bg-transparent pb-18 pt-12 sm:pb-22 sm:pt-14 lg:pb-26 lg:pt-18">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute left-0 top-16 h-56 w-56 rounded-full bg-atmosphere-haze/70 blur-3xl" />
        <div className="absolute right-0 top-20 h-64 w-64 rounded-full bg-atmosphere-haze/62 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: reduce ? 0 : motionDuration.slow, ease: premiumEase }}
          className="mx-auto max-w-2xl text-center"
        >
          <h2 className="text-balance text-headline font-semibold text-ink-espresso">
            Starting points for the first months
          </h2>
          <p className="mt-5 text-pretty text-base leading-relaxed text-ink-base/68 sm:text-lg">
            Quiet basics for the early days. Easy gifts for new parents.
          </p>
        </motion.div>

        <div className="mt-10 sm:mt-12">
          <ProductGrid products={products} keepsakeSlug={keepsakeSlug} />
        </div>
      </div>
    </section>
  );
}
