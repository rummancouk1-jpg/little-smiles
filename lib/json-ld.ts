import { getBlogAnchorProduct, type BlogPost } from "@/lib/blog";
import type { Product } from "@/lib/products";
import { absoluteUrl, defaultOgImagePath, siteUrl } from "@/lib/site";

/** YYYY-MM-DD 60 days from now — for Product offers.priceValidUntil.
 *  Computed at render time; refreshes naturally on each deploy. */
function priceValidUntilDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 60);
  return date.toISOString().slice(0, 10);
}

/** Sitewide Organization + WebSite graph (non-product pages). */
export function organizationAndWebsiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: "Little Smiles",
        url: siteUrl,
        logo: {
          "@type": "ImageObject",
          url: absoluteUrl(defaultOgImagePath),
          width: 240,
          height: 96,
        },
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        url: siteUrl,
        name: "Little Smiles",
        inLanguage: "en-PK",
        publisher: { "@id": `${siteUrl}/#organization` },
      },
    ],
  };
}

export function blogPostingJsonLd(post: BlogPost) {
  const pageUrl = absoluteUrl(`/blog/${post.slug}`);
  const isoPublished = `${post.publishedAt}T12:00:00+05:00`;
  // Reuse the same anchor product image the blog rail card already
  // shows for this post — keeps the Discover thumbnail consistent
  // with what the user sees on-site, and gives each post a unique
  // image instead of falling back to the brand logo.
  const anchor = getBlogAnchorProduct(post);
  const imagePath = anchor ? anchor.image : defaultOgImagePath;

  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": `${pageUrl}#article`,
    headline: post.title,
    description: post.description,
    datePublished: isoPublished,
    dateModified: isoPublished,
    author: { "@id": `${siteUrl}/#organization` },
    publisher: { "@id": `${siteUrl}/#organization` },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": pageUrl,
    },
    image: {
      "@type": "ImageObject",
      url: absoluteUrl(imagePath),
    },
    keywords: post.keywords.join(", "),
    articleSection: post.category,
    inLanguage: "en-PK",
  };
}

function productAvailabilitySchema(product: Product): string {
  if (!product.inStock) return "https://schema.org/OutOfStock";
  if (product.inventoryQty <= 3) return "https://schema.org/LimitedAvailability";
  return "https://schema.org/InStock";
}

export type BreadcrumbItem = { name: string; path: string };

/** BreadcrumbList for SERP trails — pair with page-visible breadcrumbs when you add UI later. */
export function breadcrumbJsonLdDocument(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function faqPageJsonLd(
  items: readonly { question: string; answer: string }[],
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export function productJsonLd(product: Product) {
  const pageUrl = absoluteUrl(`/shop/${product.slug}`);

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${pageUrl}#product`,
    url: pageUrl,
    name: product.name,
    sku: product.slug,
    category: product.category,
    image: [absoluteUrl(product.image)],
    description: product.description,
    brand: {
      "@type": "Brand",
      name: "Little Smiles",
    },
    offers: {
      "@type": "Offer",
      url: pageUrl,
      priceCurrency: "PKR",
      price: product.pricePkr,
      priceValidUntil: priceValidUntilDate(),
      availability: productAvailabilitySchema(product),
      itemCondition: "https://schema.org/NewCondition",
      seller: {
        "@type": "Organization",
        name: "Little Smiles",
        url: siteUrl,
      },
    },
  };
}
