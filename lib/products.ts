import { getProductSeedsFromCatalog, siteConfig } from "@/lib/catalog-config";
import { siteUrl } from "@/lib/site";

export type Product = {
  slug: string;
  name: string;
  category:
    | "Swaddle"
    | "Bodysuits"
    | "Food Bag"
    | "Bottle Case"
    | "Feeding Cushion"
    | "Bow Set"
    | "Food Container";
  image: string;
  description: string;
  pricePkr: number;
  compareAtPricePkr: number;
  /** Mirrors `launchDiscountPercent` in `data/site.json` at build time. */
  discountPercent: number;
  inventoryQty: number;
  inStock: boolean;
  featured?: boolean;
  bestSeller?: boolean;
};

export const whatsappBaseUrl = `https://wa.me/${siteConfig.whatsappPhoneE164}`;

/** PDP WhatsApp order fields — clamped to inventory server-side in builders. */
export type WhatsappOrderFields = {
  quantity: number;
  variantNote?: string;
  sizeNote?: string;
};

export function productUrl(product: Pick<Product, "slug">): string {
  return `${siteUrl}/shop/${product.slug}`;
}

/** Listing cards: color/style often matters for conversion. */
export function productShowsVariantField(product: Product): boolean {
  return true;
}

/** Bodysuits typically need a size — other categories use variant only. */
export function productShowsSizeField(product: Product): boolean {
  return product.category === "Bodysuits";
}

export function clampOrderQuantity(product: Product, quantity: number): number {
  const max = Math.max(1, product.inventoryQty);
  return Math.min(max, Math.max(1, Math.floor(quantity)));
}

/** Full template when ordering from the product detail page (scannable on mobile). */
export function buildWhatsappOrderMessage(
  product: Product,
  fields: WhatsappOrderFields,
): string {
  const qty = clampOrderQuantity(product, fields.quantity);
  const lineTotal = product.pricePkr * qty;
  const lines = [
    "Hi Little Smiles,",
    "",
    "ORDER (please confirm stock + payment + delivery):",
    "",
    `• SKU: ${product.slug}`,
    `• ${product.name}`,
    `• ${product.category}`,
  ];

  if (productShowsVariantField(product)) {
    const v = fields.variantNote?.trim();
    lines.push(
      v
        ? `• Variant: ${v}`
        : `• Variant: As on listing — please confirm before packing`,
    );
  }

  if (productShowsSizeField(product)) {
    const s = fields.sizeNote?.trim();
    lines.push(s ? `• Size: ${s}` : `• Size: Please advise what's available`);
  }

  lines.push(
    "",
    `• Qty: ${qty}`,
    `• Unit: ${formatPkr(product.pricePkr)}`,
    qty > 1 ? `• Line total: ${formatPkr(lineTotal)}` : `• Total: ${formatPkr(lineTotal)}`,
    "",
    "Pakistan delivery — reply with JazzCash/bank details if needed.",
    "",
    productUrl(product),
  );

  return lines.join("\n");
}

/** Compact inquiry from shop grid / cards (short prefilled bubble). */
export function buildWhatsappListingInquiryMessage(product: Product): string {
  return [
    "Hi Little Smiles,",
    "",
    `I'd like: ${product.name}`,
    `(${product.category})`,
    `${formatPkr(product.pricePkr)} — ${product.discountPercent}% off (was ${formatPkr(product.compareAtPricePkr)})`,
    `SKU: ${product.slug}`,
    "Qty: 1 — please confirm stock.",
    "",
    productUrl(product),
  ].join("\n");
}

type ProductSeed = Omit<Product, "pricePkr" | "discountPercent" | "inStock"> & {
  compareAtPricePkr: number;
  /** Per-SKU override; omit to use `data/site.json` `launchDiscountPercent`. */
  discountPercent?: number;
};

function withLaunchPricing(seed: ProductSeed): Product {
  const { discountPercent: override, ...rest } = seed;
  const discountPercent = override ?? siteConfig.launchDiscountPercent;
  return {
    ...rest,
    discountPercent,
    pricePkr: Math.round(seed.compareAtPricePkr * (1 - discountPercent / 100)),
    inStock: seed.inventoryQty > 0,
  };
}

const productSeeds: ProductSeed[] = getProductSeedsFromCatalog();

export const products: Product[] = productSeeds.map(withLaunchPricing);

export function getProductBySlug(slug: string) {
  return products.find((product) => product.slug === slug);
}

export function getFeaturedProducts() {
  return products.filter((product) => product.featured);
}

export function getBestSellerProducts() {
  return products.filter((product) => product.bestSeller);
}

export function formatPkr(pricePkr: number) {
  return `Rs. ${pricePkr.toLocaleString("en-PK")}`;
}

/**
 * Without `fields`: structured listing inquiry (shop grid, cards) — includes price + PDP link.
 * With `fields`: full PDP order template — quantity, variant, size, totals.
 */
export function getWhatsappOrderLink(
  product: Product,
  fields?: WhatsappOrderFields,
): string {
  const message = fields
    ? buildWhatsappOrderMessage(product, fields)
    : buildWhatsappListingInquiryMessage(product);
  return `${whatsappBaseUrl}?text=${encodeURIComponent(message)}`;
}

export function getImageCandidates(imagePath: string) {
  return [imagePath];
}
