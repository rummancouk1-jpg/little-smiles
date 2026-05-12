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
import { whatsappBaseUrl } from "@/lib/products";

type FaqItem = { question: string; answer: string };

type HomeTrustSectionProps = {
  faqs: readonly FaqItem[];
};

const trustPillars = [
  {
    title: "Comfort-led quality",
    body: "Soft, skin-friendly fabrics and thoughtful finishes parents notice after the first wash—not disposable fast-fashion knockoffs.",
    icon: Heart,
  },
  {
    title: "Honest policies",
    body: "Clear shipping timelines, return windows for genuine issues, and no surprises when something needs fixing.",
    icon: ShieldCheck,
  },
  {
    title: "WhatsApp-first care",
    body: "Order and support on the channel Pakistani families already trust—with prefilled product messages so checkout is one tap.",
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
        <div className="absolute left-1/4 top-10 h-72 w-72 rounded-full bg-[#EEE7E0]/55 blur-3xl" />
        <div className="absolute bottom-8 right-0 h-80 w-80 rounded-full bg-[#E8DFD8]/50 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-[#3B2F2F]/50">
            Shop with confidence
          </p>
          <h2
            id="trust-heading"
            className="mt-4 text-balance text-4xl font-semibold tracking-tight text-[#1F1918] sm:text-5xl"
          >
            Built for trust—not hype
          </h2>
          <p className="mt-5 text-pretty text-base leading-relaxed text-[#3B2F2F]/68 sm:text-lg">
            Shipping, returns, WhatsApp support, and real parent feedback—so you
            know what to expect before you order.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
          <Link
            href="/shipping-policy"
            className="touch-feedback group block rounded-3xl border border-[#3B2F2F]/10 bg-[#FCF8F4]/92 p-5 shadow-card-rest transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:border-[#3B2F2F]/16 hover:shadow-card-lift"
          >
            <span className="flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#F6F0EB] to-[#EEE7E1] text-[#3B2F2F]/72 ring-1 ring-[#3B2F2F]/8">
              <Truck className="size-5" strokeWidth={2} aria-hidden />
            </span>
            <p className="mt-4 text-xs font-medium uppercase tracking-[0.14em] text-[#3B2F2F]/55">
              Delivery
            </p>
            <p className="mt-2 text-lg font-semibold text-[#1F1918]">Pakistan-wide shipping</p>
            <p className="mt-2 text-sm leading-relaxed text-[#3B2F2F]/72">
              Dispatch in 24–48 hours · most cities 2–5 business days
            </p>
            <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-[#2E2323] underline decoration-[#3B2F2F]/25 underline-offset-4 transition-[text-decoration-color] group-hover:decoration-[#2E2323]/45">
              Shipping policy
              <span
                aria-hidden
                className="text-[0.95em] leading-none transition-transform duration-200 group-hover:translate-x-0.5"
              >
                →
              </span>
            </span>
          </Link>

          <Link
            href="/return-refund-policy"
            className="touch-feedback group block rounded-3xl border border-[#3B2F2F]/10 bg-[#FCF8F4]/92 p-5 shadow-card-rest transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:border-[#3B2F2F]/16 hover:shadow-card-lift"
          >
            <span className="flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#F6F0EB] to-[#EEE7E1] text-[#3B2F2F]/72 ring-1 ring-[#3B2F2F]/8">
              <RefreshCw className="size-5" strokeWidth={2} aria-hidden />
            </span>
            <p className="mt-4 text-xs font-medium uppercase tracking-[0.14em] text-[#3B2F2F]/55">
              Peace of mind
            </p>
            <p className="mt-2 text-lg font-semibold text-[#1F1918]">Fair returns</p>
            <p className="mt-2 text-sm leading-relaxed text-[#3B2F2F]/72">
              Report damage or wrong items within 48 hours on WhatsApp with photos.
            </p>
            <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-[#2E2323] underline decoration-[#3B2F2F]/25 underline-offset-4 transition-[text-decoration-color] group-hover:decoration-[#2E2323]/45">
              Return policy
              <span
                aria-hidden
                className="text-[0.95em] leading-none transition-transform duration-200 group-hover:translate-x-0.5"
              >
                →
              </span>
            </span>
          </Link>

          <a
            href={whatsappBaseUrl}
            target="_blank"
            rel="noreferrer"
            className="touch-feedback group block rounded-3xl border border-[#3B2F2F]/10 bg-[#FCF8F4]/92 p-5 shadow-card-rest transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:border-[#3B2F2F]/16 hover:shadow-card-lift"
          >
            <span className="flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#F6F0EB] to-[#EEE7E1] text-[#3B2F2F]/72 ring-1 ring-[#3B2F2F]/8">
              <MessageCircle className="size-5" strokeWidth={2} aria-hidden />
            </span>
            <p className="mt-4 text-xs font-medium uppercase tracking-[0.14em] text-[#3B2F2F]/55">
              Orders & support
            </p>
            <p className="mt-2 text-lg font-semibold text-[#1F1918]">WhatsApp-first</p>
            <p className="mt-2 text-sm leading-relaxed text-[#3B2F2F]/72">
              10am–10pm PKT · quick replies during support hours
            </p>
            <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-[#2E2323] underline decoration-[#3B2F2F]/25 underline-offset-4 transition-[text-decoration-color] group-hover:decoration-[#2E2323]/45">
              Chat on WhatsApp
              <span
                aria-hidden
                className="text-[0.95em] leading-none transition-transform duration-200 group-hover:translate-x-0.5"
              >
                →
              </span>
            </span>
          </a>

          <Link
            href="/reviews"
            className="touch-feedback group block rounded-3xl border border-[#3B2F2F]/10 bg-[#FCF8F4]/92 p-5 shadow-card-rest transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:border-[#3B2F2F]/16 hover:shadow-card-lift"
          >
            <span className="flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#F6F0EB] to-[#EEE7E1] text-[#3B2F2F]/72 ring-1 ring-[#3B2F2F]/8">
              <Star className="size-5" strokeWidth={2} aria-hidden />
            </span>
            <p className="mt-4 text-xs font-medium uppercase tracking-[0.14em] text-[#3B2F2F]/55">
              Social proof
            </p>
            <p className="mt-2 text-lg font-semibold text-[#1F1918]">Parent reviews</p>
            <p className="mt-2 text-sm leading-relaxed text-[#3B2F2F]/72">
              Photos and notes from families across Pakistan—not anonymous stars only.
            </p>
            <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-[#2E2323] underline decoration-[#3B2F2F]/25 underline-offset-4 transition-[text-decoration-color] group-hover:decoration-[#2E2323]/45">
              Read reviews
              <span
                aria-hidden
                className="text-[0.95em] leading-none transition-transform duration-200 group-hover:translate-x-0.5"
              >
                →
              </span>
            </span>
          </Link>
        </div>

        <div className="mt-14 rounded-3xl border border-[#3B2F2F]/9 bg-[#FBF7F3]/90 p-6 shadow-[0_26px_52px_-36px_rgba(59,47,47,0.36)] sm:p-8 lg:mt-16">
          <h3 className="text-center text-2xl font-semibold tracking-tight text-[#1F1918] sm:text-3xl">
            Why parents love us
          </h3>
          <p className="mx-auto mt-3 max-w-2xl text-center text-sm leading-relaxed text-[#3B2F2F]/68 sm:text-base">
            Editorial-quality essentials with the practicality everyday parenting demands.
          </p>
          <ul className="mt-10 grid gap-8 sm:grid-cols-3 sm:gap-6">
            {trustPillars.map(({ title, body, icon: Icon }) => (
              <li key={title} className="text-center sm:text-left">
                <span className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#F6F0EB] to-[#EEE7E1] text-[#3B2F2F]/75 ring-1 ring-[#3B2F2F]/8 sm:mx-0">
                  <Icon className="size-5" strokeWidth={2} aria-hidden />
                </span>
                <p className="mt-4 font-semibold text-[#241B1B]">{title}</p>
                <p className="mt-2 text-sm leading-relaxed text-[#3B2F2F]/74">{body}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-14 lg:mt-16">
          <h3 className="text-center text-2xl font-semibold tracking-tight text-[#1F1918] sm:text-3xl">
            Common questions
          </h3>
          <p className="mx-auto mt-3 max-w-xl text-center text-sm text-[#3B2F2F]/65">
            Quick answers about ordering and delivery—full detail lives on our policy pages.
          </p>
          <Accordion
            type="single"
            collapsible
            className="mx-auto mt-8 max-w-3xl rounded-2xl border border-[#3B2F2F]/10 bg-[#FCF8F4]/85 px-4 py-2 sm:px-6"
          >
            {faqItems.map((item, index) => (
              <AccordionItem key={item.question} value={`faq-${index}`}>
                <AccordionTrigger className="py-4 text-left text-base font-medium text-[#241B1B] hover:no-underline">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="pb-4 text-[#3B2F2F]/78">
                  <p>{item.answer}</p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}
