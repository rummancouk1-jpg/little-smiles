export default function ShopLoading() {
  return (
    <main className="min-h-screen bg-surface-grain px-4 py-8 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-6xl space-y-6">
        <div className="h-32 animate-pulse rounded-3xl bg-white/80" />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-72 animate-pulse rounded-3xl bg-white/85" />
          ))}
        </div>
      </section>
    </main>
  );
}
