"use client";

import { useState } from "react";

import { ProductImage } from "@/components/product-image";
import { categoryMatClass } from "@/components/product-grid";
import { cn } from "@/lib/utils";
import { getImageCandidates, type Product } from "@/lib/products";

/**
 * PDP product imagery. Shows one clean premium shot when the product has a
 * single image (today's data), and automatically upgrades to a main image plus
 * a thumbnail strip the moment a product carries 2+ images (`product.images`).
 * No fake thumbnails, no padded filler — the strip only appears when there is
 * something real to switch between. Presentation only; touches no order state.
 */
export function ProductGallery({ product }: { product: Product }) {
  const images =
    product.images && product.images.length > 0
      ? product.images
      : [product.image];
  const hasMultiple = images.length > 1;

  const [activeIndex, setActiveIndex] = useState(0);
  const active = images[Math.min(activeIndex, images.length - 1)];

  return (
    <div>
      {/* The arch window — same signature as the grid cards, on the
          product's category mat, grounded by the contact shadow. */}
      <div
        className={cn(
          "arch-frame pb-8 pt-12 sm:pb-10 sm:pt-16",
          categoryMatClass[product.category] ?? "bg-mat-butter",
        )}
      >
        <div className="relative mx-auto aspect-square w-[70%] sm:w-[66%]">
          <ProductImage
            sources={getImageCandidates(active)}
            alt={`${product.name} — ${product.category} by Little Smiles Pakistan`}
            fill
            className="object-contain object-center"
            sizes="(max-width: 1024px) 70vw, 34vw"
            priority
          />
        </div>
        <div aria-hidden className="arch-floor bottom-[5%] h-4 w-[54%]" />
      </div>

      {hasMultiple ? (
        <ul className="mt-4 flex flex-wrap gap-3" aria-label={`${product.name} images`}>
          {images.map((src, index) => {
            const isActive = index === activeIndex;
            return (
              <li key={src}>
                <button
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  aria-label={`View image ${index + 1} of ${images.length}`}
                  aria-pressed={isActive}
                  className={cn(
                    "relative h-16 w-16 overflow-hidden rounded-2xl bg-surface-well p-2 ring-inset transition-[opacity,box-shadow] duration-200 sm:h-20 sm:w-20",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-marigold/50",
                    isActive
                      ? "ring-2 ring-accent-marigold"
                      : "opacity-80 ring-1 ring-ink-base/10 hover:opacity-100",
                  )}
                >
                  <ProductImage
                    sources={getImageCandidates(src)}
                    alt=""
                    fill
                    className="object-contain object-center"
                    sizes="80px"
                  />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
