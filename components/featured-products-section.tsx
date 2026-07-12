import { ProductGrid } from "@/components/product-grid";
import { Reveal } from "@/components/reveal";
import { getFeaturedProducts } from "@/lib/products";

export function FeaturedProductsSection() {
  const products = getFeaturedProducts();
  // Keepsake tier: the lead featured product that is also a bestseller
  // (first featured otherwise). Wired off the existing catalog flags — no
  // new data. Currently resolves to "fly-high-swaddle".
  const keepsakeSlug =
    products.find((p) => p.bestSeller)?.slug ?? products[0]?.slug;

  return (
    // Paper chapter — atmosphere blobs removed; the band rhythm carries
    // the page's chapters now (Golden Hour).
    <section className="relative bg-transparent pb-18 pt-12 sm:pb-22 sm:pt-14 lg:pb-26 lg:pt-18">
      <div className="relative mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-headline font-semibold text-ink-espresso">
            Starting points for the first months
          </h2>
          <p className="mt-5 text-pretty text-base leading-relaxed text-ink-base/68 sm:text-lg">
            Quiet basics for the early days. Easy gifts for new parents.
          </p>
        </Reveal>

        <div className="mt-10 sm:mt-12">
          <ProductGrid products={products} keepsakeSlug={keepsakeSlug} />
        </div>
      </div>
    </section>
  );
}
