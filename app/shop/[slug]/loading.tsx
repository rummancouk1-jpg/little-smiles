export default function ProductLoading() {
  return (
    <main className="min-h-screen bg-[#FDF8F4] px-4 py-8 sm:px-6 lg:px-8">
      <section className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-2">
        <div className="h-[420px] animate-pulse rounded-3xl bg-white/85" />
        <div className="space-y-4">
          <div className="h-4 w-40 animate-pulse rounded bg-[#3B2F2F]/10" />
          <div className="h-10 w-64 animate-pulse rounded bg-[#3B2F2F]/10" />
          <div className="h-6 w-32 animate-pulse rounded bg-[#3B2F2F]/10" />
          <div className="h-40 animate-pulse rounded-2xl bg-white/85" />
        </div>
      </section>
    </main>
  );
}
