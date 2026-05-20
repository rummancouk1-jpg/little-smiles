// Shared skeleton primitives for the contentops admin routes. Used by
// per-route loading.tsx files so the operator sees the structural
// shape of the page they're navigating to instead of a flash of empty.
//
// Calm: a single subtle animate-pulse, rounded boxes matching the same
// tokens as the real surfaces. No shimmer, no gradient, no motion
// beyond a gentle opacity pulse.

import { cn } from "@/lib/utils";

type SkeletonBlockProps = {
  className?: string;
};

export function SkeletonBlock({ className }: SkeletonBlockProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-2xl bg-[#3B2F2F]/8",
        className,
      )}
    />
  );
}

// Pre-shaped skeletons for the most common surface shapes. Each is
// composed from SkeletonBlocks; pages import what they need.

export function SkeletonHeader() {
  return (
    <div className="rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-5 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-7">
      <div className="space-y-3">
        <SkeletonBlock className="h-3 w-24" />
        <SkeletonBlock className="h-9 w-64" />
        <SkeletonBlock className="h-4 w-96 max-w-full" />
      </div>
    </div>
  );
}

export function SkeletonCard({ className }: SkeletonBlockProps) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-[#3B2F2F]/10 bg-white/85 p-5 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-7",
        className,
      )}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <SkeletonBlock className="h-3 w-32" />
          <SkeletonBlock className="h-5 w-10" />
        </div>
        <SkeletonBlock className="h-4 w-full" />
        <SkeletonBlock className="h-4 w-3/4" />
        <SkeletonBlock className="h-3 w-24" />
      </div>
    </div>
  );
}

export function SkeletonRowList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-[#3B2F2F]/10 bg-white/85 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)]">
      {Array.from({ length: rows }).map((_, idx) => (
        <div
          key={idx}
          className={cn(
            "flex items-center justify-between gap-3 px-5 py-4",
            idx > 0 ? "border-t border-[#3B2F2F]/8" : "",
          )}
        >
          <SkeletonBlock className="h-4 w-2/3" />
          <SkeletonBlock className="h-5 w-16" />
          <SkeletonBlock className="h-3 w-12" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonFilterPills({ count = 4 }: { count?: number }) {
  return (
    <div className="flex flex-wrap gap-2">
      {Array.from({ length: count }).map((_, idx) => (
        <SkeletonBlock key={idx} className="h-7 w-20" />
      ))}
    </div>
  );
}
