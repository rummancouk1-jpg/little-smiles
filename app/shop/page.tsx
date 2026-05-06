import { ShopCategoryTabs } from "@/components/shop-category-tabs";
import { products } from "@/lib/products";

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
          <ShopCategoryTabs products={products} />
        </div>
      </section>
    </main>
  );
}
