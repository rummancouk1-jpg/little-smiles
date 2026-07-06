export default function RootLoading() {
  return (
    <main className="min-h-screen bg-surface-page px-4 py-10 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-6xl space-y-6">
        <div className="h-24 animate-pulse rounded-3xl bg-white/70" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-56 animate-pulse rounded-3xl bg-white/75" />
          ))}
        </div>
      </section>
    </main>
  );
}
