import { Reveal } from "@/components/reveal";
import { breadcrumbJsonLdDocument } from "@/lib/json-ld";
import { staticPageMetadata } from "@/lib/seo-metadata";

export const metadata = staticPageMetadata({
  title: "Return & Refund Policy",
  description:
    "How to report damaged or incorrect Little Smiles items within 48 hours, eligibility for returns, and refund timing for approved cases in Pakistan.",
  path: "/return-refund-policy",
});

const breadcrumbLd = breadcrumbJsonLdDocument([
  { name: "Home", path: "/" },
  { name: "Return & Refund Policy", path: "/return-refund-policy" },
]);

export default function ReturnRefundPolicyPage() {
  return (
    <main className="min-h-screen bg-surface-grain pb-16 pt-10 sm:pt-12 lg:pt-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <section className="mx-auto max-w-4xl px-5 sm:px-6 lg:px-8">
        <article className="rounded-3xl border border-ink-base/8 bg-surface-raised/85 p-7 shadow-[0_22px_44px_-30px_rgba(59,47,47,0.4)] sm:p-10">
          <h1 className="text-3xl font-semibold tracking-tight text-ink-walnut sm:text-4xl">
            Return and Refund Policy
          </h1>
          <p className="mt-4 text-base leading-relaxed text-ink-base/75">
            We stand behind the quality of what we ship. If something arrives
            damaged, defective, or not what you ordered, contact us quickly so we
            can make it right—this policy explains how that works in Pakistan.
          </p>

          <Reveal as="h2" className="mt-10 text-xl font-semibold tracking-tight text-ink-espresso">
            Reporting window
          </Reveal>
          <p className="mt-3 text-base leading-relaxed text-ink-base/75">
            Please message us on{" "}
            <strong className="font-semibold text-ink-walnut">WhatsApp within 48 hours</strong>{" "}
            of delivery with your order reference and clear photos of the issue
            (outer packaging, labels, and the product concern). Late reports may
            limit our ability to verify with the courier.
          </p>

          <Reveal as="h2" className="mt-10 text-xl font-semibold tracking-tight text-ink-espresso">
            Eligible situations
          </Reveal>
          <p className="mt-3 text-base leading-relaxed text-ink-base/75">
            We prioritize manufacturing defects, shipping damage, or wrong SKU
            shipped versus what you confirmed on WhatsApp. Change-of-mind
            returns may be declined unless we explicitly offer that window for a
            campaign—ask before purchase if you need flexibility.
          </p>

          <Reveal as="h2" className="mt-10 text-xl font-semibold tracking-tight text-ink-espresso">
            Condition for returns
          </Reveal>
          <p className="mt-3 text-base leading-relaxed text-ink-base/75">
            Approved returns must be unused, unwashed, with original packaging
            and tags intact—unless the defect makes that impossible (for example,
            a torn seam discovered on inspection).
          </p>

          <Reveal as="h2" className="mt-10 text-xl font-semibold tracking-tight text-ink-espresso">
            Refunds and timing
          </Reveal>
          <p className="mt-3 text-base leading-relaxed text-ink-base/75">
            Once a return is approved and the item is received back (when a
            return shipment is required), refunds are typically processed within{" "}
            <strong className="font-semibold text-ink-walnut">
              5–7 business days
            </strong>{" "}
            using the same payment channel where possible. Bank timelines may add
            a short settlement delay beyond our control.
          </p>

          <Reveal as="h2" className="mt-10 text-xl font-semibold tracking-tight text-ink-espresso">
            Non-returnable cases
          </Reveal>
          <p className="mt-3 text-base leading-relaxed text-ink-base/75">
            Items that show wear, washing, or missing packaging after delivery
            generally cannot be returned unless we approved an exception in
            writing. Hygiene-sensitive goods may have additional restrictions—we
            will state this on the product page when relevant.
          </p>
        </article>
      </section>
    </main>
  );
}
