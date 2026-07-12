import Image from "next/image";
import Link from "next/link";
import { Reveal } from "@/components/reveal";
import { Button } from "@/components/ui/button";
import { whatsappBaseUrl } from "@/lib/products";
import { homepageTestimonials } from "@/lib/testimonials";
import { cn } from "@/lib/utils";

export function TestimonialsSection() {
  return (
    <section className="relative overflow-hidden bg-transparent pb-20 pt-8 sm:pb-24 sm:pt-10 lg:pb-28 lg:pt-12">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -left-12 top-20 h-56 w-56 rounded-full bg-atmosphere-haze/64 blur-3xl" />
        <div className="absolute right-0 top-10 h-64 w-64 rounded-full bg-atmosphere-haze/60 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <Reveal className="max-w-2xl">
          <p className="eyebrow">Letters</p>
          <h2 className="mt-4 text-balance text-headline font-semibold text-ink-espresso">
            From families across Pakistan
          </h2>
          <p className="mt-5 text-pretty text-base leading-relaxed text-ink-base/68 sm:text-lg">
            Photos and a few words sent in from across the country.
          </p>
        </Reveal>

        <div className="mobile-rail mt-10 flex snap-x gap-4 overflow-x-auto pb-1 sm:mt-12 sm:grid sm:snap-none sm:grid-cols-2 sm:items-stretch sm:gap-5 sm:overflow-visible lg:grid-cols-5">
          {homepageTestimonials.map((item, index) => {
            const isHero = index === 0;
            return (
              <Reveal
                as="article"
                key={item.id}
                index={index}
                className={cn(
                  "flex min-w-[84%] snap-start flex-col overflow-hidden rounded-3xl border border-ink-base/9 bg-surface-panel/95 shadow-card-rest sm:min-w-0",
                  isHero && "lg:col-span-2 lg:grid lg:grid-cols-2 lg:flex-row"
                )}
              >
                <div
                  className={cn(
                    "relative aspect-square overflow-hidden bg-atmosphere-mist",
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
                        ? "font-heading italic text-xl leading-[1.3] text-ink-espresso sm:text-[1.35rem] lg:text-[1.5rem]"
                        : "text-sm leading-relaxed text-ink-base/74"
                    )}
                  >
                    &ldquo;{item.quote}&rdquo;
                  </p>
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-ink-base/58">
                    {item.author} - {item.location}
                  </p>
                </div>
              </Reveal>
            );
          })}
        </div>
        <Reveal className="mt-10 flex justify-center sm:mt-12">
          {/* Gentle/human ask, not commerce — stitched outline keeps it quiet
              so marigold stays reserved for buying actions. */}
          <Button
            asChild
            variant="outline"
            className="h-11 rounded-full border-dashed border-ink-base/35 bg-transparent px-7 text-sm font-medium text-ink-walnut shadow-none transition-[transform,background-color] duration-300 hover:-translate-y-0.5 hover:bg-surface-hover"
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
        </Reveal>
        <p className="mt-6 text-center text-sm text-ink-base/58">
          <Link
            href="/reviews"
            className="font-medium text-ink-walnut underline decoration-ink-base/25 underline-offset-4 transition-colors hover:decoration-ink-walnut/50"
          >
            Read more reviews
          </Link>
        </p>
      </div>
    </section>
  );
}
