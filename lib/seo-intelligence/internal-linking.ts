// Internal linking intelligence. Derives orphan / cluster / anchor signals
// strictly from real repo data: lib/blog.ts, lib/products.ts, and the
// rendered section content. No external crawl, no fabricated authority.

import { blogPosts, getBlogAnchorProduct, type BlogPost } from "@/lib/blog";
import { products, type Product } from "@/lib/products";

import type { Diagnostic, SubjectReport } from "@/lib/seo-intelligence/types";

const INTERNAL_LINK_REGEX = /\/(shop|blog)\/[A-Za-z0-9_-]+/g;
const CATEGORY_LINK_REGEX = /\/shop\?category=[^"'\s)]+/g;

export type InboundLinkSource = {
  fromKind: "homepage" | "shop_listing" | "best_sellers" | "category_filter" | "blog_listing" | "blog_post_body" | "blog_cta" | "json_ld_breadcrumb";
  fromLabel: string;
};

export type LinkGraphEntry = {
  slug: string;
  title: string;
  inbound: InboundLinkSource[];
};

export type InternalLinkingReport = {
  blogs: LinkGraphEntry[];
  products: LinkGraphEntry[];
  blogReports: SubjectReport[];
  productReports: SubjectReport[];
  clusterStrength: CategoryClusterEntry[];
  globalDiagnostics: Diagnostic[];
};

export type CategoryClusterEntry = {
  category: string;
  productCount: number;
  blogPostCount: number;
  level: "empty" | "weak" | "balanced" | "strong";
  notes: string;
};

function collectInternalReferences(text: string): {
  postSlugs: Set<string>;
  productSlugs: Set<string>;
  categoryHrefs: Set<string>;
} {
  const postSlugs = new Set<string>();
  const productSlugs = new Set<string>();
  const categoryHrefs = new Set<string>();

  const linkMatches = text.matchAll(INTERNAL_LINK_REGEX);
  for (const match of linkMatches) {
    const [whole, kind] = match;
    const slug = whole.split("/").pop()!;
    if (kind === "blog") postSlugs.add(slug);
    if (kind === "shop") productSlugs.add(slug);
  }

  const categoryMatches = text.matchAll(CATEGORY_LINK_REGEX);
  for (const match of categoryMatches) {
    categoryHrefs.add(match[0]);
  }

  return { postSlugs, productSlugs, categoryHrefs };
}

function blogPostFullText(post: BlogPost): string {
  const sectionText = post.sections
    .map((section) => `${section.heading}\n${section.content.join("\n")}`)
    .join("\n");
  return `${post.title}\n${post.description}\n${sectionText}\n${post.cta.label} ${post.cta.href}`;
}

export function buildInternalLinkingReport(): InternalLinkingReport {
  const blogMap = new Map<string, LinkGraphEntry>();
  const productMap = new Map<string, LinkGraphEntry>();

  for (const post of blogPosts) {
    blogMap.set(post.slug, { slug: post.slug, title: post.title, inbound: [] });
  }
  for (const product of products) {
    productMap.set(product.slug, { slug: product.slug, title: product.name, inbound: [] });
  }

  // --- Real, derivable inbound link sources ---

  // Every published post is listed on /blog.
  for (const entry of blogMap.values()) {
    entry.inbound.push({ fromKind: "blog_listing", fromLabel: "/blog index" });
  }

  // Every published product is listed on /shop and is reachable via
  // /shop?category=<category> filter UI.
  for (const product of products) {
    const entry = productMap.get(product.slug);
    if (!entry) continue;
    entry.inbound.push({ fromKind: "shop_listing", fromLabel: "/shop index" });
    entry.inbound.push({
      fromKind: "category_filter",
      fromLabel: `/shop?category=${product.category}`,
    });
    if (product.featured) {
      entry.inbound.push({ fromKind: "homepage", fromLabel: "Featured rail on /" });
    }
    if (product.bestSeller) {
      entry.inbound.push({ fromKind: "best_sellers", fromLabel: "/best-sellers" });
    }
    // PDP JSON-LD includes a BreadcrumbList that links back through /shop.
    entry.inbound.push({ fromKind: "json_ld_breadcrumb", fromLabel: "Breadcrumb JSON-LD on PDP" });
  }

  // Homepage's "latest blog" rail shows the most recent N posts. We honour
  // whatever ordering blogPosts ships in — the rail truncates to the same
  // top-of-array slice the component uses.
  const HOMEPAGE_BLOG_RAIL = 3;
  blogPosts.slice(0, HOMEPAGE_BLOG_RAIL).forEach((post) => {
    const entry = blogMap.get(post.slug);
    if (entry) entry.inbound.push({ fromKind: "homepage", fromLabel: "Latest blog rail on /" });
  });

  // Cross-references inside post bodies + CTA hrefs.
  for (const post of blogPosts) {
    const text = blogPostFullText(post);
    const refs = collectInternalReferences(text);
    for (const slug of refs.postSlugs) {
      if (slug === post.slug) continue;
      const entry = blogMap.get(slug);
      if (entry) {
        entry.inbound.push({
          fromKind: "blog_post_body",
          fromLabel: `Mentioned in /blog/${post.slug}`,
        });
      }
    }
    for (const slug of refs.productSlugs) {
      const entry = productMap.get(slug);
      if (entry) {
        entry.inbound.push({
          fromKind: "blog_cta",
          fromLabel: `Linked from /blog/${post.slug}`,
        });
      }
    }
  }

  // --- Per-subject diagnostics ---

  const blogReports = buildBlogDiagnostics(blogMap);
  const productReports = buildProductDiagnostics(productMap);
  const clusterStrength = buildClusterStrength();
  const globalDiagnostics = buildGlobalDiagnostics(blogMap);

  return {
    blogs: Array.from(blogMap.values()),
    products: Array.from(productMap.values()),
    blogReports,
    productReports,
    clusterStrength,
    globalDiagnostics,
  };
}

function buildBlogDiagnostics(blogMap: Map<string, LinkGraphEntry>): SubjectReport[] {
  return blogPosts.map((post) => {
    const entry = blogMap.get(post.slug)!;
    const diagnostics: Diagnostic[] = [];

    // Orphan check: every post has at least /blog as inbound, so true
    // orphans are impossible — but if it's missing from the homepage rail
    // AND no other post links to it, treat it as "low-flow".
    const homepageRail = entry.inbound.some((s) => s.fromKind === "homepage");
    const peerLinks = entry.inbound.filter((s) => s.fromKind === "blog_post_body").length;
    const totalNonListing = entry.inbound.filter((s) => s.fromKind !== "blog_listing").length;

    if (totalNonListing === 0) {
      diagnostics.push({
        severity: "warning",
        message: "Post is only reachable from /blog index.",
        derivation: "No homepage rail slot, no peer-post body links, no other inbound link source detected.",
        hint: "Mention this post inside another related post's body to add an inbound link.",
      });
    } else if (peerLinks === 0 && !homepageRail) {
      diagnostics.push({
        severity: "info",
        message: "No peer-post body references.",
        derivation: "Scanned every published post's section content; no other post references this slug.",
        hint: "Cross-link from a related post in the same relatedProductCategory.",
      });
    }

    // CTA pointing to a real category that has at least one in-stock product.
    const categorySlug = post.relatedProductCategory;
    const ctaTargets = products.filter((p) => p.category === categorySlug && p.inStock);
    if (ctaTargets.length === 0) {
      diagnostics.push({
        severity: "warning",
        message: `CTA category "${categorySlug}" has no in-stock products.`,
        derivation: "Filtered lib/products.ts by category and inStock=true; zero matches.",
        hint: "Re-stock the category or update the post's relatedProductCategory.",
      });
    }

    // Anchor product check — same logic the JSON-LD uses for hero image.
    const anchor = getBlogAnchorProduct(post);
    if (!anchor) {
      diagnostics.push({
        severity: "warning",
        message: "No anchor product available for hero image.",
        derivation: "getBlogAnchorProduct() returned null — category has zero products.",
        hint: "Add at least one product in the related category to unlock the hero image.",
      });
    } else if (!anchor.inStock) {
      diagnostics.push({
        severity: "info",
        message: `Anchor product "${anchor.name}" is out of stock.`,
        derivation: "Anchor falls back to first in-category product when none in-stock; check inventoryQty.",
        hint: "Mark another product in this category as featured + in-stock.",
      });
    }

    return {
      subject: { kind: "blog", slug: post.slug, title: post.title },
      diagnostics,
    };
  });
}

function buildProductDiagnostics(productMap: Map<string, LinkGraphEntry>): SubjectReport[] {
  return products.map((product) => {
    const entry = productMap.get(product.slug)!;
    const diagnostics: Diagnostic[] = [];

    const blogCtaLinks = entry.inbound.filter((s) => s.fromKind === "blog_cta").length;
    if (blogCtaLinks === 0) {
      diagnostics.push({
        severity: "info",
        message: "No blog post links to this product directly.",
        derivation: "Scanned every blog post's section content + CTA href for /shop/<slug>; zero matches.",
        hint: "Mention this product slug in a blog section if it's a strong anchor for that topic.",
      });
    }

    if (!product.featured && !product.bestSeller) {
      diagnostics.push({
        severity: "info",
        message: "Not featured and not flagged as best-seller.",
        derivation: "Both `featured` and `bestSeller` are false in lib/products.ts.",
        hint: "Promote in catalog if this product earns its rail spot.",
      });
    }

    if (product.availabilityStatus === "out_of_stock") {
      diagnostics.push({
        severity: "warning",
        message: "Out of stock.",
        derivation: "availabilityStatus = out_of_stock — affects internal-linking value for blog anchors.",
        hint: "Restock or hide from category to keep the link graph clean.",
      });
    }

    return {
      subject: { kind: "product", slug: product.slug, title: product.name },
      diagnostics,
    };
  });
}

function buildClusterStrength(): CategoryClusterEntry[] {
  const productCategories = new Set<Product["category"]>(products.map((p) => p.category));
  const blogCategories = new Set(blogPosts.map((p) => p.relatedProductCategory));
  const allCategories = new Set<string>([...productCategories, ...blogCategories]);

  return Array.from(allCategories)
    .sort()
    .map((category) => {
      const productCount = products.filter((p) => p.category === category).length;
      const blogPostCount = blogPosts.filter((p) => p.relatedProductCategory === category).length;
      let level: CategoryClusterEntry["level"] = "balanced";
      let notes = "";
      if (productCount === 0 && blogPostCount === 0) {
        level = "empty";
        notes = "Neither products nor blog posts in this category.";
      } else if (productCount === 0) {
        level = "weak";
        notes = "Blog posts present but no products — CTA cannot land on a real catalog category.";
      } else if (blogPostCount === 0) {
        level = "weak";
        notes = "Products present but no editorial content — missed topical anchor.";
      } else if (productCount >= 3 && blogPostCount >= 1) {
        level = "strong";
        notes = "Multiple products plus editorial coverage — healthy topical cluster.";
      } else {
        level = "balanced";
        notes = "Both sides represented; consider adding more editorial depth.";
      }
      return { category, productCount, blogPostCount, level, notes };
    });
}

function buildGlobalDiagnostics(blogMap: Map<string, LinkGraphEntry>): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  // Detect blog→blog graph density.
  const peerLinks = Array.from(blogMap.values()).reduce(
    (sum, entry) => sum + entry.inbound.filter((s) => s.fromKind === "blog_post_body").length,
    0,
  );
  if (peerLinks === 0 && blogPosts.length > 1) {
    diagnostics.push({
      severity: "warning",
      message: "Zero peer-post body references across the blog.",
      derivation: `Scanned ${blogPosts.length} posts' section content for /blog/<slug> references; none found.`,
      hint: "Add at least one in-text link from each post to a thematically related post.",
    });
  }

  return diagnostics;
}
