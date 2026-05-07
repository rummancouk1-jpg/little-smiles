import { z } from "zod";

import catalogFile from "@/data/catalog.json";
import siteFile from "@/data/site.json";

const categorySchema = z.enum([
  "Swaddle",
  "Bodysuits",
  "Food Bag",
  "Bottle Case",
  "Feeding Cushion",
  "Bow Set",
  "Food Container",
]);

const productRowSchema = z.object({
  slug: z.string().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().min(1),
  category: categorySchema,
  image: z
    .string()
    .min(1)
    .refine((p) => p.startsWith("/products/"), "image must be under /products/"),
  description: z.string().min(1),
  compareAtPricePkr: z.number().int().positive(),
  inventoryQty: z.number().int().min(0),
  featured: z.boolean().optional(),
  bestSeller: z.boolean().optional(),
  /** Set false to hide from shop, sitemap, and PDP without deleting data. */
  published: z.boolean().optional().default(true),
});

const catalogSchema = z.object({
  products: z
    .array(productRowSchema)
    .min(1)
    .superRefine((rows, ctx) => {
      const seen = new Set<string>();
      for (let i = 0; i < rows.length; i++) {
        const slug = rows[i].slug;
        if (seen.has(slug)) {
          ctx.addIssue({
            code: "custom",
            message: `Duplicate slug: ${slug}`,
            path: [i, "slug"],
          });
        }
        seen.add(slug);
      }
    }),
});

const siteSchema = z.object({
  whatsappPhoneE164: z.string().regex(/^[1-9]\d{9,14}$/),
  launchDiscountPercent: z.number().int().min(0).max(90),
});

export type SiteConfig = z.infer<typeof siteSchema>;
export type CatalogProductRow = z.infer<typeof productRowSchema>;

export const siteConfig: SiteConfig = siteSchema.parse(siteFile);

const catalogParsed = catalogSchema.parse(catalogFile);

/** Rows including `published`; use for admin/export tools. */
export const catalogProductRows: CatalogProductRow[] = catalogParsed.products;

/** Seeds consumed by `lib/products.ts` (no `published` field). */
export function getProductSeedsFromCatalog(): Omit<
  CatalogProductRow,
  "published"
>[] {
  return catalogParsed.products
    .filter((row) => row.published !== false)
    .map(({ published: _p, ...seed }) => seed);
}
