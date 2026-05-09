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
  /** Short listing copy (cards / grids). */
  shortDescription: string;
  /** Richer detail copy for PDP + SEO. */
  longDescription: string;
  /** Backward-compat alias for older usages. */
  description: string;
  pricePkr: number;
  compareAtPricePkr: number;
  /** Mirrors `launchDiscountPercent` in `data/site.json` at build time. */
  discountPercent: number;
  inventoryQty: number;
  inStock: boolean;
  availabilityStatus: "in_stock" | "limited_stock" | "out_of_stock";
  dispatchTimeline: string;
  deliveryEstimate: string;
  careNote: string;
  giftingNote: string;
  whatsappOrderMessage: string;
  featured?: boolean;
  bestSeller?: boolean;
};

export const whatsappBaseUrl = `https://wa.me/${siteConfig.whatsappPhoneE164}`;

/** PDP WhatsApp order fields — clamped to inventory server-side in builders. */
export type WhatsappOrderFields = {
  quantity: number;
  variantNote?: string;
  sizeNote?: string;
  customerNote?: string;
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

export function getAvailabilityStatus(
  product: Pick<Product, "inStock" | "inventoryQty">,
): Product["availabilityStatus"] {
  if (!product.inStock || product.inventoryQty <= 0) return "out_of_stock";
  if (product.inventoryQty <= 3) return "limited_stock";
  return "in_stock";
}

export function getAvailabilityLabel(product: Pick<Product, "availabilityStatus" | "inventoryQty">): string {
  if (product.availabilityStatus === "out_of_stock") return "Out of stock";
  if (product.availabilityStatus === "limited_stock") return `Only ${product.inventoryQty} left`;
  return "In stock";
}

export function hasMeaningfulDiscount(product: Pick<Product, "pricePkr" | "compareAtPricePkr">): boolean {
  if (product.compareAtPricePkr <= product.pricePkr) return false;
  const percent = ((product.compareAtPricePkr - product.pricePkr) / product.compareAtPricePkr) * 100;
  return percent >= 8;
}

export function getDiscountBadgeLabel(
  product: Pick<Product, "discountPercent" | "pricePkr" | "compareAtPricePkr">,
): string | null {
  if (!hasMeaningfulDiscount(product)) return null;
  return `${product.discountPercent}% OFF`;
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

  const note = fields.customerNote?.trim();

  lines.push(
    "",
    `• Qty: ${qty}`,
    `• Unit: ${formatPkr(product.pricePkr)}`,
    qty > 1 ? `• Line total: ${formatPkr(lineTotal)}` : `• Total: ${formatPkr(lineTotal)}`,
    `• Customer note: ${note || "[Please add any color/size/address instructions]"}`,
    "",
    "Pakistan delivery — reply with JazzCash/bank details if needed.",
    "",
    productUrl(product),
  );

  return lines.join("\n");
}

type WhatsappListingMessageProduct = Pick<
  Product,
  "name" | "category" | "pricePkr" | "discountPercent" | "compareAtPricePkr" | "slug"
>;

/** Compact inquiry from shop grid / cards (short prefilled bubble). */
export function buildWhatsappListingInquiryMessage(product: WhatsappListingMessageProduct): string {
  return [
    "Hi Little Smiles,",
    "",
    "I'd like to place an order:",
    `• Product: ${product.name}`,
    `• Category: ${product.category}`,
    `• Price: ${formatPkr(product.pricePkr)} (${product.discountPercent}% off; was ${formatPkr(product.compareAtPricePkr)})`,
    `• SKU: ${product.slug}`,
    "• Qty: [Please enter quantity]",
    "• Customer note: [Any variant / size / color preference]",
    "",
    `• Product URL: ${productUrl(product)}`,
  ].join("\n");
}

type ProductSeed = ReturnType<typeof getProductSeedsFromCatalog>[number];

type ProductSeedWithPricing = ProductSeed & {
  compareAtPricePkr: number;
  /** Per-SKU override; omit to use `data/site.json` `launchDiscountPercent`. */
  discountPercent?: number;
};

function withLaunchPricing(seed: ProductSeedWithPricing): Product {
  const { discountPercent: override, ...rest } = seed;
  const discountPercent = override ?? siteConfig.launchDiscountPercent;
  const inStock = seed.inventoryQty > 0;
  const availabilityStatus = getAvailabilityStatus({
    inStock,
    inventoryQty: seed.inventoryQty,
  });
  const shortDescription = seed.description;
  const longDescription =
    seed.longDescription?.trim() ||
    `${seed.description} Designed for parents in Pakistan who want dependable quality, easy care, and practical everyday use.`;

  const trustByCategory: Record<Product["category"], Pick<
    Product,
    "dispatchTimeline" | "deliveryEstimate" | "careNote" | "giftingNote"
  >> = {
    Swaddle: {
      dispatchTimeline: "Dispatch in 24-48 hours after order confirmation.",
      deliveryEstimate: "Usually delivered in 2-5 business days across Pakistan.",
      careNote: "Gentle wash recommended; dry in shade for longer-lasting softness.",
      giftingNote: "A practical and thoughtful newborn gift for daily comfort.",
    },
    Bodysuits: {
      dispatchTimeline: "Dispatch in 24-48 hours after order confirmation.",
      deliveryEstimate: "Usually delivered in 2-5 business days across Pakistan.",
      careNote: "Machine wash on gentle cycle with similar colors.",
      giftingNote: "Great for baby shower gifting and everyday wardrobe use.",
    },
    "Food Bag": {
      dispatchTimeline: "Dispatch in 24-48 hours after order confirmation.",
      deliveryEstimate: "Usually delivered in 2-5 business days across Pakistan.",
      careNote: "Wipe clean and air dry after use.",
      giftingNote: "A useful gift for parents who travel with feeding essentials.",
    },
    "Bottle Case": {
      dispatchTimeline: "Dispatch in 24-48 hours after order confirmation.",
      deliveryEstimate: "Usually delivered in 2-5 business days across Pakistan.",
      careNote: "Wipe clean regularly and keep dry between uses.",
      giftingNote: "A practical add-on gift for newborn care kits.",
    },
    "Feeding Cushion": {
      dispatchTimeline: "Dispatch in 24-48 hours after order confirmation.",
      deliveryEstimate: "Usually delivered in 2-5 business days across Pakistan.",
      careNote: "Spot clean cover and keep in a dry, clean area.",
      giftingNote: "A comfort-focused gift for new parents and feeding routines.",
    },
    "Bow Set": {
      dispatchTimeline: "Dispatch in 24-48 hours after order confirmation.",
      deliveryEstimate: "Usually delivered in 2-5 business days across Pakistan.",
      careNote: "Store in a dry place and handle gently to maintain shape.",
      giftingNote: "A cute gift option for birthdays, visits, and baby events.",
    },
    "Food Container": {
      dispatchTimeline: "Dispatch in 24-48 hours after order confirmation.",
      deliveryEstimate: "Usually delivered in 2-5 business days across Pakistan.",
      careNote: "Wash and dry thoroughly after each use.",
      giftingNote: "A practical gift add-on for meal prep and daily outings.",
    },
  };

  const baseProduct = {
    ...rest,
    shortDescription,
    longDescription,
    description: shortDescription,
    discountPercent,
    pricePkr: Math.round(seed.compareAtPricePkr * (1 - discountPercent / 100)),
    inStock,
    availabilityStatus,
    ...trustByCategory[seed.category],
  } satisfies Omit<Product, "whatsappOrderMessage">;

  return {
    ...baseProduct,
    whatsappOrderMessage: buildWhatsappListingInquiryMessage(baseProduct),
  };
}

const productSeeds: ProductSeedWithPricing[] = getProductSeedsFromCatalog();

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

export function getRelatedProducts(product: Product, limit = 4): Product[] {
  const sameCategory = products
    .filter((item) => item.slug !== product.slug && item.category === product.category && item.inStock)
    .sort((a, b) => Number(b.bestSeller) - Number(a.bestSeller) || b.inventoryQty - a.inventoryQty);

  if (sameCategory.length >= limit) return sameCategory.slice(0, limit);

  const filler = products
    .filter((item) => item.slug !== product.slug && item.inStock && item.category !== product.category)
    .sort((a, b) => Number(b.bestSeller) - Number(a.bestSeller) || Number(b.featured) - Number(a.featured));

  return [...sameCategory, ...filler].slice(0, limit);
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
  const message = fields ? buildWhatsappOrderMessage(product, fields) : product.whatsappOrderMessage;
  return `${whatsappBaseUrl}?text=${encodeURIComponent(message)}`;
}

export function getImageCandidates(imagePath: string) {
  return [imagePath];
}
