import Link from "next/link";

import type { Product } from "@/lib/products";

type HomeCategoryLinksProps = {
  products: Product[];
};

const categoryOrder: Product["category"][] = [
  "Swaddle",
  "Bodysuits",
  "Food Bag",
  "Bottle Case",
  "Feeding Cushion",
  "Food Container",
  "Bow Set",
];

export function HomeCategoryLinks({ products }: HomeCategoryLinksProps) {
  const unique = new Set(products.map((product) => product.category));
  const categories = categoryOrder.filter((category) => unique.has(category));

  const countByCategory = products.reduce<Record<string, number>>((acc, product) => {
    acc[product.category] = (acc[product.category] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <section className="relative pb-8 sm:pb-10">
      <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-ink-base/8 bg-surface-raised/56 p-4 backdrop-blur-sm sm:p-5">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-ink-base/50">
            Shop by Category
          </p>
          <div className="mobile-rail mt-3 flex gap-2.5 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">
            {categories.map((category) => (
              <Link
                key={category}
                href={`/shop?category=${encodeURIComponent(category)}`}
                className="touch-feedback inline-flex shrink-0 snap-start items-center rounded-full border border-ink-base/12 bg-surface-raised/70 px-3.5 py-1.5 text-sm font-medium text-ink-base/78 hover:bg-ink-walnut hover:text-ink-foreground"
              >
                {category} ({countByCategory[category] ?? 0})
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
