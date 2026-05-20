// Loading state for the editorial drafts queue.

import {
  SkeletonFilterPills,
  SkeletonHeader,
  SkeletonRowList,
} from "@/components/contentops/admin-skeleton";

export default function DraftsLoading() {
  return (
    <main className="min-h-screen bg-[#FDF8F4] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <section className="mx-auto max-w-7xl space-y-6">
        <SkeletonHeader />
        <SkeletonFilterPills count={5} />
        <SkeletonRowList rows={6} />
      </section>
    </main>
  );
}
