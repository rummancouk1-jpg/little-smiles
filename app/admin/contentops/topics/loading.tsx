// Loading state for the topic queue. Card grid mirrors the real
// surface so navigation stays visually stable.

import {
  SkeletonBlock,
  SkeletonFilterPills,
  SkeletonHeader,
} from "@/components/contentops/admin-skeleton";

export default function TopicsLoading() {
  return (
    <main className="min-h-screen bg-[#FDF8F4] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <section className="mx-auto max-w-7xl space-y-6">
        <SkeletonHeader />
        <SkeletonFilterPills count={5} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-5 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-7"
            >
              <div className="flex items-start justify-between gap-2">
                <SkeletonBlock className="h-3 w-24" />
                <SkeletonBlock className="h-5 w-16" />
              </div>
              <SkeletonBlock className="mt-3 h-6 w-full" />
              <SkeletonBlock className="mt-2 h-4 w-3/4" />
              <SkeletonBlock className="mt-3 h-3 w-1/2" />
              <SkeletonBlock className="mt-3 h-3 w-2/3" />
              <SkeletonBlock className="mt-5 h-9 w-32" />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
