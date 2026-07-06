import { ProductGrid } from "@/components/product-grid";
import { bestSellersPageMetadata } from "@/lib/commercial-seo";
import { breadcrumbJsonLdDocument } from "@/lib/json-ld";
import { getBestSellerProducts } from "@/lib/products";

export const metadata = bestSellersPageMetadata;

const bestSellerBreadcrumbLd = breadcrumbJsonLdDocument([
  { name: "Home", path: "/" },
  { name: "Best Sellers", path: "/best-sellers" },
]);

export default function BestSellersPage() {
  const bestSellers = getBestSellerProducts();

  return (
    <main className="min-h-screen bg-surface-grain pb-16 pt-10 sm:pt-12 lg:pt-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(bestSellerBreadcrumbLd),
        }}
      />
      <section className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-ink-base/50">
            Parent Favorites
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-ink-walnut sm:text-5xl">
            Best Sellers
          </h1>
          <p className="mt-4 text-base leading-relaxed text-ink-base/70 sm:text-lg">
            The most-loved Little Smiles essentials trusted by families.
          </p>
        </div>

        <div className="mt-10 sm:mt-12">
          <ProductGrid products={bestSellers} />
        </div>
      </section>
    </main>
  );
}
