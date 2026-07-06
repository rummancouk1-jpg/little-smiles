"use client";

import Link from "next/link";
import {
  Heart,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  Star,
  Truck,
} from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Reveal } from "@/components/reveal";
import { whatsappBaseUrl } from "@/lib/products";

type FaqItem = { question: string; answer: string };

type HomeTrustSectionProps = {
  faqs: readonly FaqItem[];
};

const trustPillars = [
  {
    title: "Comfort-led quality",
    body: "Soft fabrics and thoughtful finishes — the kind parents notice after the first wash.",
    icon: Heart,
  },
  {
    title: "Honest policies",
    body: "Clear shipping timelines, fair return windows, and no surprises when something needs fixing.",
    icon: ShieldCheck,
  },
  {
    title: "WhatsApp-first care",
    body: "Order and support on WhatsApp — prefilled messages so checkout is one tap.",
    icon: MessageCircle,
  },
] as const;

export function HomeTrustSection({ faqs }: HomeTrustSectionProps) {
  const faqItems = [...faqs];

  return (
    <section
      id="trust"
      aria-labelledby="trust-heading"
      className="relative overflow-hidden bg-transparent pb-18 pt-14 sm:pb-22 sm:pt-16 lg:pb-26 lg:pt-20"
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute left-1/4 top-10 h-72 w-72 rounded-full bg-atmosphere-haze/55 blur-3xl" />
        <div className="absolute bottom-8 right-0 h-80 w-80 rounded-full bg-atmosphere-shade/50 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-ink-base/50">
            Shop with confidence
          </p>
          <h2
            id="trust-heading"
            className="mt-4 text-balance text-headline font-semibold text-ink-espresso"
          >
            <span className="italic">Care</span> continues after the order
          </h2>
          <p className="mt-5 text-pretty text-base leading-relaxed text-ink-base/68 sm:text-lg">
            Here&apos;s what to expect once you place an order.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
          <Reveal index={0} className="h-full">
          <Link
            href="/shipping-policy"
            className="touch-feedback group block h-full rounded-3xl border border-ink-base/10 bg-surface-card/92 p-5 shadow-card-rest transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:border-ink-base/16 hover:shadow-card-lift"
          >
            <span className="flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-atmosphere-veil to-atmosphere-haze text-ink-base/72 ring-1 ring-ink-base/8">
              <Truck className="size-5" strokeWidth={2} aria-hidden />
            </span>
            <p className="mt-4 text-xs font-medium uppercase tracking-[0.14em] text-ink-base/55">
              Delivery
            </p>
            <p className="mt-2 text-lg font-semibold text-ink-espresso">Pakistan-wide shipping</p>
            <p className="mt-2 text-sm leading-relaxed text-ink-base/72">
              Dispatch in 24–48 hours · most cities 2–5 business days
            </p>
            <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-ink-walnut underline decoration-ink-base/25 underline-offset-4 transition-[text-decoration-color] group-hover:decoration-ink-walnut/45">
              Shipping policy
              <span
                aria-hidden
                className="text-[0.95em] leading-none transition-transform duration-200 group-hover:translate-x-0.5"
              >
                →
              </span>
            </span>
          </Link>
          </Reveal>

          <Reveal index={1} className="h-full">
          <Link
            href="/return-refund-policy"
            className="touch-feedback group block h-full rounded-3xl border border-ink-base/10 bg-surface-card/92 p-5 shadow-card-rest transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:border-ink-base/16 hover:shadow-card-lift"
          >
            <span className="flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-atmosphere-veil to-atmosphere-haze text-ink-base/72 ring-1 ring-ink-base/8">
              <RefreshCw className="size-5" strokeWidth={2} aria-hidden />
            </span>
            <p className="mt-4 text-xs font-medium uppercase tracking-[0.14em] text-ink-base/55">
              Peace of mind
            </p>
            <p className="mt-2 text-lg font-semibold text-ink-espresso">Fair returns</p>
            <p className="mt-2 text-sm leading-relaxed text-ink-base/72">
              Report damage or wrong items within 48 hours on WhatsApp with photos.
            </p>
            <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-ink-walnut underline decoration-ink-base/25 underline-offset-4 transition-[text-decoration-color] group-hover:decoration-ink-walnut/45">
              Return policy
              <span
                aria-hidden
                className="text-[0.95em] leading-none transition-transform duration-200 group-hover:translate-x-0.5"
              >
                →
              </span>
            </span>
          </Link>
          </Reveal>

          <Reveal index={2} className="h-full">
          <a
            href={whatsappBaseUrl}
            target="_blank"
            rel="noreferrer"
            className="touch-feedback group block h-full rounded-3xl border border-ink-base/10 bg-surface-card/92 p-5 shadow-card-rest transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:border-ink-base/16 hover:shadow-card-lift"
          >
            <span className="flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-atmosphere-veil to-atmosphere-haze text-ink-base/72 ring-1 ring-ink-base/8">
              <MessageCircle className="size-5" strokeWidth={2} aria-hidden />
            </span>
            <p className="mt-4 text-xs font-medium uppercase tracking-[0.14em] text-ink-base/55">
              Orders & support
            </p>
            <p className="mt-2 text-lg font-semibold text-ink-espresso">WhatsApp-first</p>
            <p className="mt-2 text-sm leading-relaxed text-ink-base/72">
              10am–10pm PKT · quick replies during support hours
            </p>
            <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-ink-walnut underline decoration-ink-base/25 underline-offset-4 transition-[text-decoration-color] group-hover:decoration-ink-walnut/45">
              Chat on WhatsApp
              <span
                aria-hidden
                className="text-[0.95em] leading-none transition-transform duration-200 group-hover:translate-x-0.5"
              >
                →
              </span>
            </span>
          </a>
          </Reveal>

          <Reveal index={3} className="h-full">
          <Link
            href="/reviews"
            className="touch-feedback group block h-full rounded-3xl border border-ink-base/10 bg-surface-card/92 p-5 shadow-card-rest transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:border-ink-base/16 hover:shadow-card-lift"
          >
            <span className="flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-atmosphere-veil to-atmosphere-haze text-ink-base/72 ring-1 ring-ink-base/8">
              <Star className="size-5" strokeWidth={2} aria-hidden />
            </span>
            <p className="mt-4 text-xs font-medium uppercase tracking-[0.14em] text-ink-base/55">
              From parents
            </p>
            <p className="mt-2 text-lg font-semibold text-ink-espresso">Parent reviews</p>
            <p className="mt-2 text-sm leading-relaxed text-ink-base/72">
              Photos and notes from families across Pakistan.
            </p>
            <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-ink-walnut underline decoration-ink-base/25 underline-offset-4 transition-[text-decoration-color] group-hover:decoration-ink-walnut/45">
              Read reviews
              <span
                aria-hidden
                className="text-[0.95em] leading-none transition-transform duration-200 group-hover:translate-x-0.5"
              >
                →
              </span>
            </span>
          </Link>
          </Reveal>
        </div>

        <Reveal className="mt-14 rounded-3xl border border-ink-base/9 bg-surface-panel/90 p-6 shadow-[0_26px_52px_-36px_rgba(59,47,47,0.36)] sm:p-8 lg:mt-16">
          <h3 className="text-center text-2xl font-semibold tracking-tight text-ink-espresso sm:text-3xl">
            What we focus on
          </h3>
          <p className="mx-auto mt-3 max-w-2xl text-center text-sm leading-relaxed text-ink-base/68 sm:text-base">
            The three things that matter most behind every order.
          </p>
          <ul className="mt-10 grid gap-8 sm:grid-cols-3 sm:gap-6">
            {trustPillars.map(({ title, body, icon: Icon }) => (
              <li key={title} className="text-center sm:text-left">
                <span className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-atmosphere-veil to-atmosphere-haze text-ink-base/75 ring-1 ring-ink-base/8 sm:mx-0">
                  <Icon className="size-5" strokeWidth={2} aria-hidden />
                </span>
                <p className="mt-4 font-semibold text-ink-espresso">{title}</p>
                <p className="mt-2 text-sm leading-relaxed text-ink-base/74">{body}</p>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal className="mt-14 lg:mt-16">
          <h3 className="text-center text-2xl font-semibold tracking-tight text-ink-espresso sm:text-3xl">
            Common questions
          </h3>
          <p className="mx-auto mt-3 max-w-xl text-center text-sm text-ink-base/65">
            Quick answers about ordering and delivery—full detail lives on our policy pages.
          </p>
          <Accordion
            type="single"
            collapsible
            className="mx-auto mt-8 max-w-3xl rounded-2xl border border-ink-base/10 bg-surface-card/85 px-4 py-2 sm:px-6"
          >
            {faqItems.map((item, index) => (
              <AccordionItem key={item.question} value={`faq-${index}`}>
                <AccordionTrigger className="py-4 text-left text-base font-medium text-ink-espresso hover:no-underline">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="pb-4 text-ink-base/78">
                  <p>{item.answer}</p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  );
}
