import { Suspense } from "react";

import { PakistanServiceNotes } from "@/components/pakistan-service-notes";
import { ShopCategoryTabs } from "@/components/shop-category-tabs";
import { shopPageMetadata } from "@/lib/commercial-seo";
import { breadcrumbJsonLdDocument } from "@/lib/json-ld";
import { products } from "@/lib/products";

export const metadata = shopPageMetadata;

const shopBreadcrumbLd = breadcrumbJsonLdDocument([
  { name: "Home", path: "/" },
  { name: "Shop", path: "/shop" },
]);

function ShopCategoryTabsFallback() {
  return (
    <div
      className="w-full space-y-6"
      aria-hidden
    >
      <div className="mb-4 flex items-center justify-between gap-3 sm:mb-5">
        <div className="h-9 w-[9.5rem] rounded-full bg-ink-base/10 sm:hidden" />
        <div className="ml-auto h-9 w-44 rounded-full bg-ink-base/10" />
      </div>
      <div className="mobile-rail flex gap-2 overflow-x-auto pb-1">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-10 w-28 shrink-0 rounded-full bg-ink-base/10"
          />
        ))}
      </div>
      <div className="mt-8 grid gap-6 sm:mt-10 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="overflow-hidden rounded-3xl border border-ink-base/9 bg-surface-card/94 shadow-[0_24px_52px_-34px_rgba(59,47,47,0.36)]"
          >
            <div className="aspect-[4/5] bg-surface-well/90" />
            <div className="space-y-3 p-5">
              <div className="h-4 w-3/4 rounded-md bg-ink-base/10" />
              <div className="h-3 w-full rounded-md bg-ink-base/8" />
              <div className="h-10 w-full rounded-full bg-ink-base/12" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ShopPage() {
  return (
    <main className="min-h-screen bg-surface-grain pb-28 pt-10 sm:pb-16 sm:pt-12 lg:pt-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(shopBreadcrumbLd) }}
      />
      <section className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-ink-base/50">
            Little Smiles
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-ink-walnut sm:text-5xl">
            Shop Baby Essentials
          </h1>
          <p className="mt-4 text-base leading-relaxed text-ink-base/70 sm:text-lg">
            Curated everyday comfort pieces for newborns and growing babies —
            shipped Pakistan-wide with WhatsApp ordering and clear return
            support.
          </p>
          <PakistanServiceNotes variant="panel" className="mx-auto mt-8 max-w-2xl" />
        </div>

        <div className="mt-10 sm:mt-12">
          <Suspense fallback={<ShopCategoryTabsFallback />}>
            <ShopCategoryTabs products={products} />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
