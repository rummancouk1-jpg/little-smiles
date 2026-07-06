import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center bg-surface-page px-5 pb-20 pt-16 text-center">
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-ink-base/50">
        404
      </p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink-espresso sm:text-4xl">
        This page could not be found
      </h1>
      <p className="mt-4 max-w-md text-base leading-relaxed text-ink-base/72">
        The link may be outdated or the product may no longer be listed. Head
        back to the shop or homepage.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button asChild className="h-11 rounded-full bg-ink-walnut px-7 text-sm text-ink-foreground">
          <Link href="/shop">Go to shop</Link>
        </Button>
        <Button asChild variant="outline" className="h-11 rounded-full border-ink-base/18 bg-white/70 px-7 text-sm">
          <Link href="/">Home</Link>
        </Button>
      </div>
    </main>
  );
}
