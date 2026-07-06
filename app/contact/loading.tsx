export default function ContactLoading() {
  return (
    <main className="min-h-screen bg-surface-grain pb-16 pt-10 sm:pt-12 lg:pt-16">
      <section className="mx-auto max-w-3xl px-5 sm:px-6 lg:px-8">
        <article className="space-y-4 rounded-3xl border border-ink-base/8 bg-white/80 p-7 sm:p-10">
          <div className="h-4 w-36 animate-pulse rounded bg-ink-base/10" />
          <div className="h-10 w-60 animate-pulse rounded bg-ink-base/10" />
          <div className="h-4 w-full animate-pulse rounded bg-ink-base/10" />
          <div className="h-44 w-full animate-pulse rounded-2xl bg-ink-base/8" />
        </article>
      </section>
    </main>
  );
}
