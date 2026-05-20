// Loading state for the editorial overview. Mirrors the real page's
// structural shape so navigation feels stable: header, insights strip,
// 5-card grid, cadence timeline. Calm pulse, no shimmer.

import {
  SkeletonBlock,
  SkeletonCard,
  SkeletonHeader,
} from "@/components/contentops/admin-skeleton";

export default function OverviewLoading() {
  return (
    <main className="min-h-screen bg-[#FDF8F4] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <section className="mx-auto max-w-7xl space-y-6">
        <SkeletonHeader />

        <div className="rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-5 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-7">
          <SkeletonBlock className="h-3 w-32" />
          <div className="mt-3 space-y-2">
            <SkeletonBlock className="h-9 w-full" />
            <SkeletonBlock className="h-9 w-5/6" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 5 }).map((_, idx) => (
            <SkeletonCard key={idx} />
          ))}
        </div>

        <div className="rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-7 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-9">
          <SkeletonBlock className="h-3 w-32" />
          <SkeletonBlock className="mt-2 h-4 w-72 max-w-full" />
          <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="space-y-3">
                <SkeletonBlock className="h-3 w-20" />
                <SkeletonBlock className="h-4 w-full" />
                <SkeletonBlock className="h-4 w-2/3" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
