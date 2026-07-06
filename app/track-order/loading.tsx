export default function TrackOrderLoading() {
  return (
    <main className="min-h-screen bg-surface-grain px-4 py-10 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-3xl space-y-5">
        <header className="space-y-3 rounded-3xl border border-ink-base/10 bg-white/88 p-6 sm:p-8">
          <div className="h-4 w-44 animate-pulse rounded bg-ink-base/10" />
          <div className="h-10 w-60 animate-pulse rounded bg-ink-base/10" />
          <div className="h-4 w-full animate-pulse rounded bg-ink-base/10" />
        </header>
        <div className="h-72 animate-pulse rounded-3xl bg-white/90" />
      </section>
    </main>
  );
}
