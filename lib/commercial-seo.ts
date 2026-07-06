import type { Metadata } from "next";

import type { Product } from "@/lib/products";
import { siteUrl } from "@/lib/site";

/** Curated for on-page SEO: best sellers first, then flagship featured SKUs (10 total). */
export const topCommercialProductSlugs = [
  "fly-high-swaddle",
  "dino-deer-bodysuits",
  "blue-and-white-food-bag",
  "space-rocket-bottle-case",
  "natures-cuddle-swaddle",
  "unicorn-swaddle",
  "tiny-quote-print-bodysuits",
  "tiny-quote-goggles-bodysuits",
  "blue-feeding-cushion",
  "floral-bow-flower-bow-set",
] as const;

export type TopCommercialSlug = (typeof topCommercialProductSlugs)[number];

const indexable: Metadata["robots"] = {
  index: true,
  follow: true,
  googleBot: { index: true, follow: true },
};

/**
 * Primary intent: premium baby essentials + Pakistan (brand homepage).
 */
export const homePageMetadata: Metadata = {
  title: "Premium Baby Essentials Pakistan",
  description:
    "Considered baby essentials for families in Pakistan. Swaddles, bodysuits, feeding gear, and small gifts — order on WhatsApp.",
  alternates: { canonical: siteUrl },
  robots: indexable,
  openGraph: {
    title: "Premium Baby Essentials Pakistan | Little Smiles",
    description:
      "Swaddles, bodysuits, feeding gear, and newborn gifts—curated for comfort and everyday use across Pakistan.",
    url: siteUrl,
    type: "website",
    locale: "en_PK",
    siteName: "Little Smiles",
  },
  twitter: {
    card: "summary_large_image",
    title: "Premium Baby Essentials Pakistan | Little Smiles",
    description:
      "Swaddles, bodysuits, feeding gear, and newborn gifts—curated for comfort and everyday use across Pakistan.",
  },
};

/**
 * Primary intent: commercial catalog / shop all products (Pakistan).
 */
export const shopPageMetadata: Metadata = {
  title: "Shop Baby Essentials Online (Pakistan)",
  description:
    "The full Little Smiles catalog — swaddles, bodysuits, food bags, bottle cases, feeding cushions, and bow sets. Order on WhatsApp, shipped across Pakistan.",
  alternates: { canonical: `${siteUrl}/shop` },
  robots: indexable,
  openGraph: {
    title: "Shop Baby Essentials Online (Pakistan) | Little Smiles",
    description:
      "Full catalog—filter by category. Nationwide shipping in Pakistan (24–48h dispatch; typically 2–5 business days). Order on WhatsApp with clear return support.",
    url: `${siteUrl}/shop`,
    type: "website",
    locale: "en_PK",
    siteName: "Little Smiles",
  },
  twitter: {
    card: "summary_large_image",
    title: "Shop Baby Essentials Online (Pakistan) | Little Smiles",
    description:
      "Full catalog—filter by category. Nationwide shipping in Pakistan (24–48h dispatch; typically 2–5 business days). Order on WhatsApp with clear return support.",
  },
};

/**
 * Primary intent: contact, WhatsApp orders, delivery & returns reassurance (Pakistan).
 */
export const contactPageMetadata: Metadata = {
  title: "Contact & WhatsApp Support",
  description:
    "Get in touch with Little Smiles on WhatsApp, 10am–10pm PKT. For damaged or wrong items, message us within 48 hours of delivery.",
  alternates: { canonical: `${siteUrl}/contact` },
  robots: indexable,
  openGraph: {
    title: "Contact & WhatsApp Support | Little Smiles",
    description:
      "WhatsApp support for orders in Pakistan, plus delivery timelines and how to report an issue within 48 hours of delivery.",
    url: `${siteUrl}/contact`,
    type: "website",
    locale: "en_PK",
    siteName: "Little Smiles",
  },
  twitter: {
    card: "summary_large_image",
    title: "Contact & WhatsApp Support | Little Smiles",
    description:
      "WhatsApp support for orders in Pakistan, plus delivery timelines and how to report an issue within 48 hours of delivery.",
  },
};

/**
 * Primary intent: bestselling / social-proof collection.
 */
export const bestSellersPageMetadata: Metadata = {
  title: "Best-Selling Baby Products in Pakistan",
  description:
    "Little Smiles best sellers — swaddles, bodysuits, and feeding gear parents reach for first. Order on WhatsApp for nationwide delivery.",
  alternates: { canonical: `${siteUrl}/best-sellers` },
  robots: indexable,
  openGraph: {
    title: "Best-Selling Baby Products in Pakistan | Little Smiles",
    description:
      "Parent favorites: premium swaddles, bodysuits, and feeding essentials—ready to order.",
    url: `${siteUrl}/best-sellers`,
    type: "website",
    locale: "en_PK",
    siteName: "Little Smiles",
  },
  twitter: {
    card: "summary_large_image",
    title: "Best-Selling Baby Products in Pakistan | Little Smiles",
    description:
      "Parent favorites: premium swaddles, bodysuits, and feeding essentials—ready to order.",
  },
};

type ProductSeoFields = {
  title: string;
  description: string;
};

const categoryPrimaryPhrase: Record<Product["category"], string> = {
  Swaddle: "baby swaddle Pakistan",
  Bodysuits: "baby bodysuits Pakistan",
  "Food Bag": "baby food bag Pakistan",
  "Bottle Case": "baby bottle case Pakistan",
  "Feeding Cushion": "baby feeding cushion Pakistan",
  "Bow Set": "baby bow set Pakistan",
  "Food Container": "baby food container Pakistan",
};

/** Titles & descriptions tuned to one primary keyword phrase per URL (top commercial URLs). */
const productSeoBySlug: Partial<Record<TopCommercialSlug, ProductSeoFields>> = {
  "fly-high-swaddle": {
    title: "Fly High Baby Swaddle — Premium Newborn Wrap (Pakistan)",
    description:
      "Buy the Fly High baby swaddle in Pakistan: ultra-soft wrap for calmer sleep and easy swaddling. Premium cotton feel—order on WhatsApp with Pakistan-wide delivery.",
  },
  "dino-deer-bodysuits": {
    title: "Dino Deer Baby Bodysuits — Premium Daily Wear (Pakistan)",
    description:
      "Shop Dino Deer baby bodysuits online in Pakistan: soft premium knits for daily wear and easy changes. Limited stock—order on WhatsApp.",
  },
  "blue-and-white-food-bag": {
    title: "Blue & White Insulated Baby Food Bag (Pakistan)",
    description:
      "Insulated baby food bag for organized feeding on the go in Pakistan. Sleek layout for bottles and snacks—order on WhatsApp while stock lasts.",
  },
  "space-rocket-bottle-case": {
    title: "Space Rocket Insulated Baby Bottle Case (Pakistan)",
    description:
      "Insulated baby bottle case for safer travel in Pakistan—Space Rocket print with a clean, premium finish. Order on WhatsApp for quick purchase.",
  },
  "natures-cuddle-swaddle": {
    title: "Nature's Cuddle Baby Swaddle — Breathable Cotton (Pakistan)",
    description:
      "Nature's Cuddle baby swaddle: breathable premium wrap for secure swaddling and cozy sleep in Pakistan. Order on WhatsApp with nationwide delivery.",
  },
  "unicorn-swaddle": {
    title: "Unicorn Baby Swaddle — Soft Cotton Newborn Wrap (Pakistan)",
    description:
      "Unicorn print baby swaddle in Pakistan: gentle cotton with a refined look for naps and everyday comfort. Order on WhatsApp while inventory lasts.",
  },
  "tiny-quote-print-bodysuits": {
    title: "Tiny Quote Baby Bodysuits — Soft Everyday Essentials (Pakistan)",
    description:
      "Tiny Quote baby bodysuits in Pakistan: breathable essentials for gentle skin and quick diaper changes. Premium comfort—order on WhatsApp.",
  },
  "tiny-quote-goggles-bodysuits": {
    title: "Tiny Quote Goggles Baby Bodysuits (Pakistan)",
    description:
      "Playful premium baby bodysuits with a soft hand-feel for daily wear in Pakistan. Order on WhatsApp for fast ordering and delivery options.",
  },
  "blue-feeding-cushion": {
    title: "Blue Baby Feeding Cushion — Nursing Support (Pakistan)",
    description:
      "Supportive blue baby feeding cushion for calmer nursing and bottle feeds in Pakistan. Ergonomic comfort—order on WhatsApp while stock lasts.",
  },
  "floral-bow-flower-bow-set": {
    title: "Floral Baby Bow Set — Premium Hair Accessories (Pakistan)",
    description:
      "Floral baby bow set for polished, occasion-ready looks in Pakistan. Premium finish and gentle wear—order on WhatsApp.",
  },
};

function truncateMetaDescription(text: string, max = 158): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (oneLine.length <= max) return oneLine;
  return `${oneLine.slice(0, max - 1).trimEnd()}…`;
}

function fallbackProductMetadata(product: Product): ProductSeoFields {
  const phrase = categoryPrimaryPhrase[product.category];
  const title = `${product.name} — ${product.category} (Pakistan)`;
  const description = truncateMetaDescription(
    `${product.name}: ${product.description} Shop ${phrase} at Little Smiles—order on WhatsApp with Pakistan-wide delivery.`
  );
  return { title, description };
}

export function getProductDetailMetadata(product: Product): Metadata {
  const override = productSeoBySlug[product.slug as TopCommercialSlug];
  const core = override ?? fallbackProductMetadata(product);
  const pageUrl = `${siteUrl}/shop/${product.slug}`;

  // og:image / twitter:image are supplied by the route's opengraph-image.tsx +
  // twitter-image.tsx (a composed 1200×630 product card), so they're
  // intentionally omitted here to avoid duplicate image tags.
  return {
    title: core.title,
    description: core.description,
    alternates: { canonical: pageUrl },
    robots: indexable,
    openGraph: {
      title: core.title,
      description: core.description,
      url: pageUrl,
      type: "website",
      locale: "en_PK",
      siteName: "Little Smiles",
    },
    twitter: {
      card: "summary_large_image",
      title: core.title,
      description: core.description,
    },
  };
}
