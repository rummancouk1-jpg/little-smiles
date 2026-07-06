import Link from "next/link";

import { ContactForm } from "@/components/contact-form";
import { PakistanServiceNotes } from "@/components/pakistan-service-notes";
import { Button } from "@/components/ui/button";
import { contactPageMetadata } from "@/lib/commercial-seo";
import { breadcrumbJsonLdDocument } from "@/lib/json-ld";
import { whatsappBaseUrl } from "@/lib/products";

export const metadata = contactPageMetadata;

const contactBreadcrumbLd = breadcrumbJsonLdDocument([
  { name: "Home", path: "/" },
  { name: "Contact", path: "/contact" },
]);

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-surface-grain pb-16 pt-10 sm:pt-12 lg:pt-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(contactBreadcrumbLd) }}
      />
      <section className="mx-auto max-w-3xl px-5 sm:px-6 lg:px-8">
        <article className="rounded-3xl border border-ink-base/8 bg-white/80 p-7 shadow-[0_22px_44px_-30px_rgba(59,47,47,0.4)] sm:p-10">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-ink-base/50">
            Contact Little Smiles
          </p>
          <h1 className="mt-4 text-headline font-semibold text-ink-walnut">
            We are here to <span className="italic">help</span>
          </h1>
          <p className="mt-4 text-base leading-relaxed text-ink-base/72 sm:text-lg">
            For product details, gifting support, or order assistance, message us
            anytime and our team will guide you.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-ink-base/66">
            WhatsApp support hours: 10:00 AM – 10:00 PM (PKT). We usually reply
            within 15–60 minutes during support hours.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-ink-base/68">
            Need your order status?{" "}
            <Link href="/track-order" className="font-medium text-ink-walnut underline underline-offset-2 hover:text-ink-espresso">
              Track your order
            </Link>
            {" "}with your order ID and phone number.
          </p>

          <PakistanServiceNotes variant="panel" className="mt-8" />

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              asChild
              className="h-11 rounded-full bg-accent-blush px-7 text-sm font-medium text-ink-walnut shadow-[0_14px_32px_-20px_rgba(110,83,86,0.52)] transition-[transform,box-shadow,background-color] duration-300 hover:-translate-y-0.5 hover:bg-accent-blush-strong"
            >
              <Link href={whatsappBaseUrl} target="_blank" rel="noreferrer">
                WhatsApp Support
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-11 rounded-full border-ink-walnut/14 bg-white/70 px-7 text-sm font-medium text-ink-walnut"
            >
              <Link href="mailto:littlesmiles.co.uk@gmail.com">
                littlesmiles.co.uk@gmail.com
              </Link>
            </Button>
          </div>

          <ContactForm />
        </article>
      </section>
    </main>
  );
}
