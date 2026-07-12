// Catalog grounding for the drafting model. Generates a FACTUAL summary of
// the real catalog (lib/products.ts) plus hard rules about what the model
// may NOT claim. Fixes the worst audit failure: the model inventing store
// facts it was never given (e.g. "sized newborn through 18 months" — the
// catalog carries no size data at all).

import { products, formatPkr, type Product } from "@/lib/products";

function priceRange(items: Product[]): string {
  const prices = items.map((p) => p.pricePkr).sort((a, b) => a - b);
  const lo = prices[0];
  const hi = prices[prices.length - 1];
  return lo === hi ? formatPkr(lo) : `${formatPkr(lo)}–${formatPkr(hi)}`;
}

/**
 * A grounded, factual brief the drafting prompt can trust. Everything here
 * is derived from real catalog data; the RULES section fences off the
 * claims the model kept fabricating.
 */
export function buildCatalogBrief(): string {
  const categories = [...new Set(products.map((p) => p.category))];

  const catLines = categories.map((cat) => {
    const items = products.filter((p) => p.category === cat);
    const inStock = items.filter((p) => p.inStock).length;
    return `- ${cat}: ${items.length} product(s), ${inStock} in stock, price ${priceRange(items)}.`;
  });

  // A couple of real care/gifting notes so "premium" is grounded in actual
  // product copy rather than invented specifics.
  const sampleCare = products.find((p) => p.careNote)?.careNote;

  return [
    "REAL CATALOG (the only products that exist — never invent products, slugs, sizes, or specs):",
    ...catLines,
    sampleCare ? `Example real care note: "${sampleCare}"` : "",
    "",
    "WHAT IS TRUE (safe to state):",
    "- Cash on delivery (COD) nationwide across Pakistan; ordering via WhatsApp.",
    "- Dispatch and delivery timelines vary by product and city — do not quote exact days unless the topic is generic (e.g. 'a few business days').",
    "",
    "HARD RULES — never state any of these (the catalog does NOT carry this data):",
    "- No specific SIZE ranges or age-sizing (e.g. 'newborn to 18 months'). The catalog has no size field.",
    "- No fabric composition percentages, GSM, or certifications (e.g. 'OEKO-TEX', '100% organic') unless the parent asked generically about fabric in the abstract.",
    "- No claims about materials, stitching specs, or origin that aren't generic best-practice advice.",
    "- No delivery promises, discounts, prices, or free-shipping claims beyond COD + WhatsApp.",
    "- Never say 'our [category] is sized...', 'our products are certified...', or any specific factual claim about Little Smiles inventory. Speak about what to LOOK FOR generally; let the product pages carry the specifics.",
    "When you reference the store, keep it to the true facts above and link to a category — do not describe attributes of specific stock.",
  ]
    .filter(Boolean)
    .join("\n");
}
