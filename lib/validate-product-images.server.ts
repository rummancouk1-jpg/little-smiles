import path from "node:path";
import { existsSync } from "node:fs";

import type { Product } from "@/lib/products";

declare global {
  var __littleSmilesImageGuardRan__: boolean | undefined;
}

function toPublicDiskPath(imagePath: string) {
  const relative = imagePath.replace(/^\/+/, "");
  return path.join(process.cwd(), "public", relative);
}

export function validateProductImagesOnServer(products: Product[]) {
  if (process.env.NODE_ENV === "production") return;
  if (globalThis.__littleSmilesImageGuardRan__) return;
  globalThis.__littleSmilesImageGuardRan__ = true;

  const invalidProducts: string[] = [];

  for (const product of products) {
    const image = product.image;
    const validPrefix = image.startsWith("/products/");
    const validExt = image.toLowerCase().endsWith(".png");
    const existsOnDisk = existsSync(toPublicDiskPath(image));

    if (!validPrefix || !validExt || !existsOnDisk) {
      invalidProducts.push(
        `${product.slug} -> ${image} (prefix:${validPrefix} png:${validExt} exists:${existsOnDisk})`
      );
    }
  }

  if (invalidProducts.length > 0) {
    console.warn(
      "[product-image-guard] Invalid product image references detected:\n" +
        invalidProducts.join("\n")
    );
  }
}
