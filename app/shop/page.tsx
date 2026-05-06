import { Suspense } from "react";

import { ShopCategoryTabs } from "@/components/shop-category-tabs";
import { products } from "@/lib/products";

function ShopCategoryTabsFallback() {
  return (
    <div
      className="w-full space-y-6"
      aria-hidden
    >
      <div className="mb-4 flex items-center justify-between gap-3 sm:mb-5">
        <div className="h-9 w-[9.5rem] rounded-full bg-[#3B2F2F]/10 sm:hidden" />
        <div className="ml-auto h-9 w-44 rounded-full bg-[#3B2F2F]/10" />
      </div>
      <div className="mobile-rail flex gap-2 overflow-x-auto pb-1">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-10 w-28 shrink-0 rounded-full bg-[#3B2F2F]/10"
          />
        ))}
      </div>
      <div className="mt-8 grid gap-6 sm:mt-10 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="overflow-hidden rounded-3xl border border-[#3B2F2F]/9 bg-[#FCF8F4]/94 shadow-[0_24px_52px_-34px_rgba(59,47,47,0.36)]"
          >
            <div className="aspect-[4/5] bg-[#F7F0EA]/90" />
            <div className="space-y-3 p-5">
              <div className="h-4 w-3/4 rounded-md bg-[#3B2F2F]/10" />
              <div className="h-3 w-full rounded-md bg-[#3B2F2F]/8" />
              <div className="h-10 w-full rounded-full bg-[#3B2F2F]/12" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ShopPage() {
  return (
    <main className="min-h-screen bg-[#FDF8F4] pb-28 pt-10 sm:pb-16 sm:pt-12 lg:pt-16">
      <section className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#3B2F2F]/50">
            Little Smiles
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[#2E2323] sm:text-5xl">
            Shop Baby Essentials
          </h1>
          <p className="mt-4 text-base leading-relaxed text-[#3B2F2F]/70 sm:text-lg">
            Curated everyday comfort pieces for newborns and growing babies.
          </p>
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
