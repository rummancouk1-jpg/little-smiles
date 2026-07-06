import { Reveal } from "@/components/reveal";
import { breadcrumbJsonLdDocument } from "@/lib/json-ld";
import { staticPageMetadata } from "@/lib/seo-metadata";

export const metadata = staticPageMetadata({
  title: "Terms and Conditions",
  description:
    "Terms for ordering from Little Smiles in Pakistan: pricing, availability, product representation, shipping alignment, and policy updates.",
  path: "/terms",
});

const breadcrumbLd = breadcrumbJsonLdDocument([
  { name: "Home", path: "/" },
  { name: "Terms and Conditions", path: "/terms" },
]);

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-surface-grain pb-16 pt-10 sm:pt-12 lg:pt-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <section className="mx-auto max-w-4xl px-5 sm:px-6 lg:px-8">
        <article className="rounded-3xl border border-ink-base/8 bg-surface-raised/85 p-7 shadow-[0_22px_44px_-30px_rgba(59,47,47,0.4)] sm:p-10">
          <h1 className="text-3xl font-semibold tracking-tight text-ink-walnut sm:text-4xl">
            Terms and Conditions
          </h1>
          <p className="mt-4 text-base leading-relaxed text-ink-base/75">
            These terms govern purchases made through Little Smiles channels
            (website discovery and WhatsApp ordering). By confirming an order,
            you accept pricing, availability, and timelines communicated at that
            moment, plus the shipping and return policies linked in the footer.
          </p>

          <Reveal as="h2" className="mt-10 text-xl font-semibold tracking-tight text-ink-espresso">
            Orders and acceptance
          </Reveal>
          <p className="mt-3 text-base leading-relaxed text-ink-base/75">
            An order becomes binding when we confirm it on WhatsApp (or another
            official channel we designate) with price and delivery expectations.
            We may refuse or cancel an order in cases of stock mismatch,
            suspected fraud, or courier limitations—we will explain when this
            happens.
          </p>

          <Reveal as="h2" className="mt-10 text-xl font-semibold tracking-tight text-ink-espresso">
            Pricing and promotions
          </Reveal>
          <p className="mt-3 text-base leading-relaxed text-ink-base/75">
            Prices on the website reflect current retail unless a time-bound
            discount is shown. We may adjust pricing or offers to reflect supply
            or campaign timing; the price confirmed on WhatsApp at purchase
            applies to that order.
          </p>

          <Reveal as="h2" className="mt-10 text-xl font-semibold tracking-tight text-ink-espresso">
            Product appearance
          </Reveal>
          <p className="mt-3 text-base leading-relaxed text-ink-base/75">
            We photograph products carefully, but colors and textures can vary
            slightly due to lighting, batch dye, or your screen calibration.
            Functional description and category on the product page remain the
            reference for what you receive.
          </p>

          <Reveal as="h2" className="mt-10 text-xl font-semibold tracking-tight text-ink-espresso">
            Limitation
          </Reveal>
          <p className="mt-3 text-base leading-relaxed text-ink-base/75">
            To the extent permitted under applicable law in Pakistan, Little
            Smiles is not liable for indirect losses arising from courier delays
            outside our dispatch window. Our liability for any qualifying claim
            is limited to the amount paid for the affected product unless a
            stronger remedy is required by law.
          </p>

          <Reveal as="h2" className="mt-10 text-xl font-semibold tracking-tight text-ink-espresso">
            Updates
          </Reveal>
          <p className="mt-3 text-base leading-relaxed text-ink-base/75">
            We may update these terms to reflect how we operate. Continued use
            of our services after updates constitutes acceptance of the revised
            terms for new orders.
          </p>
        </article>
      </section>
    </main>
  );
}
