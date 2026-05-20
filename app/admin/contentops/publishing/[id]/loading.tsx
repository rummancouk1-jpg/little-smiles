// Loading state for the operator publish article page. This is the
// slowest contentops route (preparePublish + linking suggestions +
// catalog read), so a structural skeleton noticeably stabilizes
// navigation. Mirrors the real layout: destination banner, summary,
// readiness, media, connections, article preview.

import {
  SkeletonBlock,
  SkeletonCard,
  SkeletonHeader,
} from "@/components/contentops/admin-skeleton";

export default function PublishArticleLoading() {
  return (
    <main className="min-h-screen bg-[#FDF8F4] px-4 pb-32 pt-8 sm:px-6 sm:pt-10 lg:px-8">
      <section className="mx-auto max-w-4xl space-y-6">
        <SkeletonHeader />

        {/* PublishingDestination */}
        <div className="rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-7 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-9">
          <div className="flex items-center justify-between">
            <SkeletonBlock className="h-3 w-40" />
            <SkeletonBlock className="h-6 w-28" />
          </div>
          <SkeletonBlock className="mt-4 h-8 w-3/4" />
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SkeletonBlock className="h-12 w-full" />
            <SkeletonBlock className="h-12 w-full" />
          </div>
        </div>

        {/* EditorialSummary */}
        <SkeletonCard />

        {/* ReadinessPanel */}
        <div className="rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-7 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-9">
          <div className="flex items-center justify-between">
            <SkeletonBlock className="h-3 w-40" />
            <SkeletonBlock className="h-6 w-20" />
          </div>
          <SkeletonBlock className="mt-2 h-4 w-72 max-w-full" />
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, idx) => (
              <SkeletonBlock key={idx} className="h-20 w-full" />
            ))}
          </div>
        </div>

        {/* MediaConfidence */}
        <div className="rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-7 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-9">
          <div className="flex items-center justify-between">
            <SkeletonBlock className="h-3 w-28" />
            <SkeletonBlock className="h-5 w-20" />
          </div>
          <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-[1fr_1.4fr]">
            <SkeletonBlock className="aspect-video w-full" />
            <div className="space-y-3">
              <SkeletonBlock className="h-4 w-full" />
              <SkeletonBlock className="h-4 w-3/4" />
              <SkeletonBlock className="h-4 w-1/2" />
            </div>
          </div>
        </div>

        {/* ArticlePreview */}
        <div className="rounded-3xl border border-[#3B2F2F]/10 bg-white/85 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)]">
          <div className="border-b border-[#3B2F2F]/8 px-7 pb-5 pt-6 sm:px-9 sm:pt-7">
            <SkeletonBlock className="h-3 w-32" />
            <SkeletonBlock className="mt-2 h-4 w-72 max-w-full" />
          </div>
          <div className="px-7 py-8 sm:px-9 sm:py-10">
            <SkeletonBlock className="h-3 w-24" />
            <SkeletonBlock className="mt-4 h-10 w-5/6" />
            <SkeletonBlock className="mt-5 h-4 w-full" />
            <SkeletonBlock className="mt-2 h-4 w-3/4" />
          </div>
        </div>
      </section>
    </main>
  );
}
