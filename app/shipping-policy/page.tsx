import { faqPageJsonLd, breadcrumbJsonLdDocument } from "@/lib/json-ld";
import { shippingPolicyFaqs } from "@/lib/shipping-faq";
import { staticPageMetadata } from "@/lib/seo-metadata";

export const metadata = staticPageMetadata({
  title: "Shipping Policy",
  description:
    "Little Smiles shipping across Pakistan: dispatch timelines, delivery windows, courier routing, and WhatsApp tracking updates.",
  path: "/shipping-policy",
});

const breadcrumbLd = breadcrumbJsonLdDocument([
  { name: "Home", path: "/" },
  { name: "Shipping Policy", path: "/shipping-policy" },
]);

const faqLd = faqPageJsonLd(shippingPolicyFaqs);

export default function ShippingPolicyPage() {
  return (
    <main className="min-h-screen bg-[#FDF8F4] pb-16 pt-10 sm:pt-12 lg:pt-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />
      <section className="mx-auto max-w-4xl px-5 sm:px-6 lg:px-8">
        <article className="rounded-3xl border border-[#3B2F2F]/8 bg-white/85 p-7 shadow-[0_22px_44px_-30px_rgba(59,47,47,0.4)] sm:p-10">
          <h1 className="text-3xl font-semibold tracking-tight text-[#2E2323] sm:text-4xl">
            Shipping Policy
          </h1>
          <p className="mt-4 text-base leading-relaxed text-[#3B2F2F]/75">
            Little Smiles ships premium baby essentials across Pakistan. This
            page explains typical timelines, how we communicate with you, and
            what to expect once your order is confirmed on WhatsApp.
          </p>

          <h2 className="mt-10 text-xl font-semibold tracking-tight text-[#241B1B]">
            Coverage and dispatch
          </h2>
          <p className="mt-3 text-base leading-relaxed text-[#3B2F2F]/75">
            We deliver to major cities and many secondary towns nationwide.
            Orders are usually dispatched within{" "}
            <strong className="font-semibold text-[#2E2323]">24–48 hours</strong>{" "}
            after confirmation, excluding weekends or courier holidays where the
            carrier does not operate.
          </p>
          <p className="mt-4 text-base leading-relaxed text-[#3B2F2F]/75">
            Dispatch means your parcel is handed to our courier partner. You
            will receive context on WhatsApp when the batch leaves our side.
          </p>

          <h2 className="mt-10 text-xl font-semibold tracking-tight text-[#241B1B]">
            Transit time
          </h2>
          <p className="mt-3 text-base leading-relaxed text-[#3B2F2F]/75">
            After dispatch, most addresses receive delivery within{" "}
            <strong className="font-semibold text-[#2E2323]">
              2–5 business days
            </strong>
            , depending on city distance and courier routing. Remote or
            hard-to-reach areas may require additional time—we flag this when we
            see it on the courier portal.
          </p>

          <h2 className="mt-10 text-xl font-semibold tracking-tight text-[#241B1B]">
            Communication
          </h2>
          <p className="mt-3 text-base leading-relaxed text-[#3B2F2F]/75">
            Delivery updates and coordination happen primarily through{" "}
            <strong className="font-semibold text-[#2E2323]">WhatsApp</strong>{" "}
            using the number you provided at checkout. Please keep that thread
            active so we can reach you if the courier needs clarification on the
            address or access.
          </p>

          <h2 className="mt-10 text-xl font-semibold tracking-tight text-[#241B1B]">
            Delays and exceptions
          </h2>
          <p className="mt-3 text-base leading-relaxed text-[#3B2F2F]/75">
            Weather, political closures, courier backlogs, or incorrect addresses
            can delay delivery. If your parcel is outside the usual window,
            message us on WhatsApp with your order summary—we will trace it with
            the courier and reply with the next step.
          </p>

          <h2 className="mt-10 text-xl font-semibold tracking-tight text-[#241B1B]">
            Frequently asked questions
          </h2>
          <dl className="mt-6 space-y-6">
            {shippingPolicyFaqs.map((item) => (
              <div key={item.question}>
                <dt className="font-semibold text-[#2E2323]">{item.question}</dt>
                <dd className="mt-2 text-base leading-relaxed text-[#3B2F2F]/78">
                  {item.answer}
                </dd>
              </div>
            ))}
          </dl>
        </article>
      </section>
    </main>
  );
}
