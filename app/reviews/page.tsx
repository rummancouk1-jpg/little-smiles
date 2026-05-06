const testimonials = [
  {
    name: "Ayesha, Lahore",
    quote:
      "Quality is genuinely premium. The swaddle stayed soft after many washes.",
  },
  {
    name: "Sana, Karachi",
    quote:
      "Loved the finish and packaging. Perfect for gifting to new parents.",
  },
  {
    name: "Hira, Islamabad",
    quote:
      "Fast support on WhatsApp and beautiful products exactly as shown.",
  },
];

export default function ReviewsPage() {
  return (
    <main className="min-h-screen bg-[#FDF8F4] pb-16 pt-10 sm:pt-12 lg:pt-16">
      <section className="mx-auto max-w-4xl px-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#3B2F2F]/50">
            Trusted By Parents
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[#2E2323] sm:text-5xl">
            Customer Reviews
          </h1>
          <p className="mt-4 text-base leading-relaxed text-[#3B2F2F]/70 sm:text-lg">
            Real feedback from families across Pakistan.
          </p>
        </div>

        <div className="mt-10 space-y-4 sm:mt-12">
          {testimonials.map((item) => (
            <article
              key={item.name}
              className="rounded-3xl border border-[#3B2F2F]/7 bg-white/80 p-6 shadow-[0_18px_40px_-28px_rgba(59,47,47,0.35)]"
            >
              <p className="text-base leading-relaxed text-[#3B2F2F]/82">
                "{item.quote}"
              </p>
              <p className="mt-3 text-sm font-medium text-[#2E2323]">{item.name}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
