"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useCart } from "@/components/cart-provider";
import { Button } from "@/components/ui/button";
import { ProductGrid } from "@/components/product-grid";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { trackAndOpenWhatsapp } from "@/lib/order-intent-client";
import { type Product, whatsappBaseUrl } from "@/lib/products";

type ShopCategoryTabsProps = {
  products: Product[];
};

export function ShopCategoryTabs({ products }: ShopCategoryTabsProps) {
  const { totalQuantity, isCartReady } = useCart();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const categoryTabsRef = useRef<HTMLDivElement | null>(null);
  const [sortBy, setSortBy] = useState<"featured" | "price-low" | "price-high" | "discount">(
    "featured"
  );

  const categories = useMemo(
    () => Array.from(new Set(products.map((product) => product.category))),
    [products]
  );

  const selectedCategory = searchParams.get("category");
  const activeTab =
    selectedCategory && categories.includes(selectedCategory as Product["category"])
      ? selectedCategory
      : "all";

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (value === "all") {
      params.delete("category");
    } else {
      params.set("category", value);
    }

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const sortLabelMap: Record<typeof sortBy, string> = {
    featured: "Best Value",
    "price-low": "Low to High",
    "price-high": "High to Low",
    discount: "Biggest Discount",
  };

  const sortProducts = (items: Product[]) => {
    const working = [...items];
    if (sortBy === "price-low") {
      return working.sort((a, b) => a.pricePkr - b.pricePkr);
    }
    if (sortBy === "price-high") {
      return working.sort((a, b) => b.pricePkr - a.pricePkr);
    }
    if (sortBy === "discount") {
      return working.sort((a, b) => b.compareAtPricePkr - b.pricePkr - (a.compareAtPricePkr - a.pricePkr));
    }
    return working.sort((a, b) => {
      const featuredDiff = Number(b.featured) - Number(a.featured);
      if (featuredDiff !== 0) return featuredDiff;
      return Number(b.bestSeller) - Number(a.bestSeller);
    });
  };

  const scrollToCategories = () => {
    categoryTabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
      <div className="mb-4 flex items-center justify-between gap-3 sm:mb-5">
        <button
          type="button"
          onClick={scrollToCategories}
          className="touch-feedback inline-flex h-9 items-center rounded-full border border-ink-base/12 bg-white/62 px-4 text-sm font-medium text-ink-base/78 sm:hidden"
        >
          Jump to Categories
        </button>
        <label className="ml-auto inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.1em] text-ink-base/55">
          Sort
          <select
            value={sortBy}
            onChange={(event) =>
              setSortBy(
                event.target.value as "featured" | "price-low" | "price-high" | "discount"
              )
            }
            className="h-9 rounded-full border border-ink-base/14 bg-white/72 px-3 text-xs font-medium tracking-normal text-ink-walnut outline-none"
          >
            <option value="featured">Best Value</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
            <option value="discount">Biggest Discount</option>
          </select>
        </label>
      </div>
      <div ref={categoryTabsRef}>
      <TabsList
        variant="line"
        className="mobile-rail h-auto w-full justify-start gap-2 overflow-x-auto rounded-2xl bg-transparent p-0 pb-1 sm:flex-wrap sm:overflow-visible"
      >
        <TabsTrigger
          value="all"
          className="touch-feedback h-10 shrink-0 rounded-full border border-ink-base/12 bg-white/62 px-4 text-sm text-ink-base/75 data-active:border-ink-walnut/15 data-active:bg-ink-walnut group-data-[variant=line]/tabs-list:data-active:bg-ink-walnut group-data-[variant=line]/tabs-list:data-active:after:opacity-0 data-active:text-ink-foreground data-active:shadow-none"
        >
          All ({products.length})
        </TabsTrigger>
        {categories.map((category) => {
          const count = products.filter((product) => product.category === category).length;
          return (
            <TabsTrigger
              key={category}
              value={category}
              className="touch-feedback h-10 shrink-0 rounded-full border border-ink-base/12 bg-white/62 px-4 text-sm text-ink-base/75 data-active:border-ink-walnut/15 data-active:bg-ink-walnut group-data-[variant=line]/tabs-list:data-active:bg-ink-walnut group-data-[variant=line]/tabs-list:data-active:after:opacity-0 data-active:text-ink-foreground data-active:shadow-none"
            >
              {category} ({count})
            </TabsTrigger>
          );
        })}
      </TabsList>
      </div>

      <TabsContent value="all" className="mt-8 sm:mt-10">
        <ProductGrid products={sortProducts(products)} />
      </TabsContent>

      {categories.map((category) => (
        <TabsContent key={category} value={category} className="mt-8 sm:mt-10">
          <ProductGrid
            products={sortProducts(
              products.filter((product) => product.category === category)
            )}
          />
        </TabsContent>
      ))}
      <div className="fixed inset-x-0 bottom-3 z-40 px-4 sm:hidden">
        <div className="mx-auto max-w-md space-y-2 rounded-2xl border border-ink-base/12 bg-surface-card/96 p-3 shadow-[0_18px_38px_-24px_rgba(59,47,47,0.45)] backdrop-blur-md">
          <p className="text-[11px] font-medium tracking-[0.09em] text-ink-base/62 uppercase">
            {activeTab === "all" ? "All Categories" : activeTab} • {sortLabelMap[sortBy]}
          </p>
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={scrollToCategories}
              className="touch-feedback inline-flex h-10 shrink-0 items-center rounded-full border border-ink-walnut/14 bg-white/70 px-3.5 text-xs font-medium text-ink-walnut transition-[background-color,border-color] duration-200 hover:border-ink-base/28 hover:bg-surface-hover"
            >
              Categories
            </button>
            <Button
              asChild
              className="h-10 min-w-0 flex-1 rounded-full bg-ink-walnut px-3 text-xs font-semibold text-ink-foreground"
            >
              <Link href="/cart" className="inline-flex items-center justify-center gap-1.5">
                View cart
                {isCartReady && totalQuantity > 0 ? (
                  <span className="rounded-full bg-ink-foreground/18 px-1.5 py-0.5 text-[0.65rem] font-bold tabular-nums">
                    {totalQuantity > 99 ? "99+" : totalQuantity}
                  </span>
                ) : null}
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-10 shrink-0 rounded-full border-ink-walnut/16 bg-white/70 px-3 text-[0.65rem] font-semibold text-ink-walnut sm:text-xs"
            >
              <Link
                href={whatsappBaseUrl}
                target="_blank"
                rel="noreferrer"
                onClick={(event) =>
                  void trackAndOpenWhatsapp(event, {
                    whatsappUrl: whatsappBaseUrl,
                    sourcePage: "shop_mobile_sticky",
                  })
                }
              >
                WhatsApp
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </Tabs>
  );
}
