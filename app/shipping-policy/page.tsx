export default function ShippingPolicyPage() {
  return (
    <main className="min-h-screen bg-[#FDF8F4] pb-16 pt-10 sm:pt-12 lg:pt-16">
      <section className="mx-auto max-w-4xl px-5 sm:px-6 lg:px-8">
        <article className="rounded-3xl border border-[#3B2F2F]/8 bg-white/85 p-7 shadow-[0_22px_44px_-30px_rgba(59,47,47,0.4)] sm:p-10">
          <h1 className="text-3xl font-semibold tracking-tight text-[#2E2323] sm:text-4xl">
            Shipping Policy
          </h1>
          <p className="mt-4 text-base leading-relaxed text-[#3B2F2F]/75">
            We currently deliver across major cities in Pakistan. Orders are
            usually dispatched within 24-48 hours and delivered in 2-5 business
            days, depending on location.
          </p>
          <p className="mt-4 text-base leading-relaxed text-[#3B2F2F]/75">
            Delivery updates are shared on WhatsApp. For urgent deliveries,
            please contact us before placing your order.
          </p>
        </article>
      </section>
    </main>
  );
}
