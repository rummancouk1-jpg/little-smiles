export default function ProductLoading() {
  return (
    <main className="min-h-screen bg-surface-grain px-4 py-8 sm:px-6 lg:px-8">
      <section className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-2">
        <div className="h-[420px] animate-pulse rounded-3xl bg-surface-raised/85" />
        <div className="space-y-4">
          <div className="h-4 w-40 animate-pulse rounded bg-ink-base/10" />
          <div className="h-10 w-64 animate-pulse rounded bg-ink-base/10" />
          <div className="h-6 w-32 animate-pulse rounded bg-ink-base/10" />
          <div className="h-40 animate-pulse rounded-2xl bg-surface-raised/85" />
        </div>
      </section>
    </main>
  );
}
