import { breadcrumbJsonLdDocument } from "@/lib/json-ld";
import { staticPageMetadata } from "@/lib/seo-metadata";

export const metadata = staticPageMetadata({
  title: "Privacy Policy",
  description:
    "How Little Smiles collects, uses, and protects your information for orders and customer support in Pakistan. We never sell personal data.",
  path: "/privacy-policy",
});

const breadcrumbLd = breadcrumbJsonLdDocument([
  { name: "Home", path: "/" },
  { name: "Privacy Policy", path: "/privacy-policy" },
]);

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-[#FDF8F4] pb-16 pt-10 sm:pt-12 lg:pt-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <section className="mx-auto max-w-4xl px-5 sm:px-6 lg:px-8">
        <article className="rounded-3xl border border-[#3B2F2F]/8 bg-white/85 p-7 shadow-[0_22px_44px_-30px_rgba(59,47,47,0.4)] sm:p-10">
          <h1 className="text-3xl font-semibold tracking-tight text-[#2E2323] sm:text-4xl">
            Privacy Policy
          </h1>
          <p className="mt-4 text-base leading-relaxed text-[#3B2F2F]/75">
            Little Smiles respects your privacy. This policy describes what we
            collect when you shop or contact us, why we need it, and how long we
            keep it. By using our website or WhatsApp ordering, you agree to this
            approach unless we agree otherwise in writing.
          </p>

          <h2 className="mt-10 text-xl font-semibold tracking-tight text-[#241B1B]">
            Information we collect
          </h2>
          <p className="mt-3 text-base leading-relaxed text-[#3B2F2F]/75">
            To fulfil orders we typically need your name, WhatsApp number,
            delivery address, and city. If you pay through a method that requires
            additional verification, we only ask for what is necessary to
            complete that transaction.
          </p>
          <p className="mt-4 text-base leading-relaxed text-[#3B2F2F]/75">
            When you email or message us, we retain those conversations so we can
            resolve issues (damages, sizing questions, or delivery changes) with
            full context.
          </p>

          <h2 className="mt-10 text-xl font-semibold tracking-tight text-[#241B1B]">
            How we use information
          </h2>
          <p className="mt-3 text-base leading-relaxed text-[#3B2F2F]/75">
            We use your details exclusively to process orders, arrange courier
            delivery, send WhatsApp updates, and provide customer support. We do
            not sell or rent your personal information to third parties for
            marketing lists.
          </p>

          <h2 className="mt-10 text-xl font-semibold tracking-tight text-[#241B1B]">
            Service providers
          </h2>
          <p className="mt-3 text-base leading-relaxed text-[#3B2F2F]/75">
            We may rely on trusted providers for hosting, analytics, or form
            delivery—each is chosen for reasonable security practices and only
            receives data required for their role (for example, routing a
            contact form submission).
          </p>

          <h2 className="mt-10 text-xl font-semibold tracking-tight text-[#241B1B]">
            Retention
          </h2>
          <p className="mt-3 text-base leading-relaxed text-[#3B2F2F]/75">
            We keep order records long enough to handle returns, accounting, and
            repeat customer care—typically aligned with practical business and
            legal retention needs in Pakistan. You may ask us to delete certain
            conversation threads where no open obligation remains.
          </p>

          <h2 className="mt-10 text-xl font-semibold tracking-tight text-[#241B1B]">
            Contact
          </h2>
          <p className="mt-3 text-base leading-relaxed text-[#3B2F2F]/75">
            For privacy-related requests, reach us through the contact options
            listed on our website. We aim to respond within reasonable business
            hours.
          </p>
        </article>
      </section>
    </main>
  );
}
