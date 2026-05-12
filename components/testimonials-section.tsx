"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { motionDuration, motionStagger, premiumEase } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { whatsappBaseUrl } from "@/lib/products";
import { homepageTestimonials } from "@/lib/testimonials";
import { cn } from "@/lib/utils";

export function TestimonialsSection() {
  const reduce = useReducedMotion();

  return (
    <section className="relative overflow-hidden bg-transparent pb-20 pt-8 sm:pb-24 sm:pt-10 lg:pb-28 lg:pt-12">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -left-12 top-20 h-56 w-56 rounded-full bg-[#ECE4DD]/64 blur-3xl" />
        <div className="absolute right-0 top-10 h-64 w-64 rounded-full bg-[#F0E8E1]/60 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: reduce ? 0 : motionDuration.slow, ease: premiumEase }}
          className="mx-auto max-w-2xl text-center"
        >
          <p className="eyebrow">Parent Stories</p>
          <h2 className="mt-4 text-balance text-4xl font-semibold tracking-tight text-[#1F1918] sm:text-5xl">
            Trusted by Families Across Pakistan
          </h2>
          <p className="mt-5 text-pretty text-base leading-relaxed text-[#3B2F2F]/68 sm:text-lg">
            Real moments from parents who chose Little Smiles for comfort,
            quality, and everyday elegance.
          </p>
        </motion.div>

        <div className="mobile-rail mt-10 flex snap-x gap-4 overflow-x-auto pb-1 sm:mt-12 sm:grid sm:snap-none sm:grid-cols-2 sm:items-stretch sm:gap-5 sm:overflow-visible lg:grid-cols-5">
          {homepageTestimonials.map((item, index) => {
            const isHero = index === 0;
            return (
              <motion.article
                key={item.id}
                initial={reduce ? false : { opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{
                  duration: reduce ? 0 : motionDuration.base,
                  delay: reduce ? 0 : index * motionStagger,
                  ease: premiumEase,
                }}
                className={cn(
                  "flex min-w-[84%] snap-start flex-col overflow-hidden rounded-3xl border border-[#3B2F2F]/9 bg-[#FBF7F3]/95 shadow-card-rest sm:min-w-0",
                  isHero && "lg:col-span-2 lg:grid lg:grid-cols-2 lg:flex-row"
                )}
              >
                <div
                  className={cn(
                    "relative aspect-square overflow-hidden bg-[#F3ECE6]",
                    isHero && "lg:aspect-auto lg:h-full"
                  )}
                >
                  <Image
                    src={item.image}
                    alt={`Customer testimonial by ${item.author}`}
                    fill
                    sizes={
                      isHero
                        ? "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 22vw"
                        : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 20vw"
                    }
                    className="object-cover object-center"
                  />
                </div>
                <div
                  className={cn(
                    isHero
                      ? "flex flex-col justify-center gap-5 px-5 pb-6 pt-5 sm:px-6 sm:pb-7 sm:pt-6 lg:px-8 lg:py-10"
                      : "space-y-3 px-4 pb-5 pt-4"
                  )}
                >
                  <p
                    className={cn(
                      isHero
                        ? "font-heading italic text-xl leading-[1.3] text-[#1F1918] sm:text-[1.35rem] lg:text-[1.5rem]"
                        : "text-sm leading-relaxed text-[#3B2F2F]/74"
                    )}
                  >
                    &ldquo;{item.quote}&rdquo;
                  </p>
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#3B2F2F]/58">
                    {item.author} - {item.location}
                  </p>
                </div>
              </motion.article>
            );
          })}
        </div>
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: reduce ? 0 : motionDuration.base, ease: premiumEase }}
          className="mt-10 flex justify-center sm:mt-12"
        >
          <Button
            asChild
            className="h-11 rounded-full bg-[#2F2624] px-7 text-sm font-medium text-[#F6F1EC] shadow-[0_14px_34px_-22px_rgba(47,38,36,0.58)] transition-[transform,box-shadow,background-color] duration-300 hover:-translate-y-0.5 hover:bg-[#251E1D] hover:shadow-[0_18px_40px_-24px_rgba(47,38,36,0.66)]"
          >
            <Link
              href={`${whatsappBaseUrl}?text=${encodeURIComponent(
                "Hi Little Smiles, I would love to share my testimonial."
              )}`}
              target="_blank"
              rel="noreferrer"
            >
              Share Your Story on WhatsApp
            </Link>
          </Button>
        </motion.div>
        <p className="mt-6 text-center text-sm text-[#3B2F2F]/58">
          <Link
            href="/reviews"
            className="font-medium text-[#2E2323] underline decoration-[#3B2F2F]/25 underline-offset-4 transition-colors hover:decoration-[#2E2323]/50"
          >
            Read more reviews
          </Link>
        </p>
      </div>
    </section>
  );
}
