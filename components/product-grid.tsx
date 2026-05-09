"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { motionDuration, motionStagger, premiumEase } from "@/lib/motion";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { trackAndOpenWhatsapp } from "@/lib/order-intent-client";
import {
  type Product,
  formatPkr,
  getAvailabilityLabel,
  getDiscountBadgeLabel,
  getImageCandidates,
  getWhatsappOrderLink,
} from "@/lib/products";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProductImage } from "@/components/product-image";
import { cn } from "@/lib/utils";

type ProductGridProps = {
  products: Product[];
};

export function ProductGrid({ products }: ProductGridProps) {
  const reduce = useReducedMotion();

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
      {products.map((product, index) => (
        <motion.div
          key={product.slug}
          initial={reduce ? false : { opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{
            duration: reduce ? 0 : motionDuration.base,
            delay: reduce ? 0 : index * motionStagger,
            ease: premiumEase,
          }}
          whileHover={reduce ? undefined : { y: -4 }}
          className="h-full"
        >
          <Card
            className={cn(
              "flex h-full overflow-hidden rounded-3xl border border-[#3B2F2F]/9 bg-[#FCF8F4]/94 py-0",
              "shadow-[0_24px_52px_-34px_rgba(59,47,47,0.36)] transition-shadow duration-300",
              "hover:shadow-[0_30px_58px_-34px_rgba(59,47,47,0.45)]"
            )}
          >
            <CardContent className="p-0">
              <Link
                href={`/shop/${product.slug}`}
                className="group block rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E2323]/24"
              >
                <div className="relative mx-3.5 mt-3.5 h-52 rounded-3xl bg-[#F7F0EA] p-4 sm:mx-4 sm:mt-4 sm:h-56 sm:p-5">
                  <div className="pointer-events-none absolute inset-0 rounded-3xl bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,255,255,0.5),transparent_65%)]" />
                  <ProductImage
                    sources={getImageCandidates(product.image)}
                    alt={`${product.name} — ${product.category} by Little Smiles`}
                    fill
                    className="object-contain object-center group-hover:scale-[1.015]"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                </div>
              </Link>
            </CardContent>
            <CardHeader className="px-4 pb-0 pt-4 sm:px-5 sm:pt-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className="w-fit border-[#3B2F2F]/12 bg-white/66 text-[#3B2F2F]/74"
                >
                  {product.category}
                </Badge>
                {getDiscountBadgeLabel(product) ? (
                  <Badge className="border-transparent bg-[#2F2624] text-[#F6F1EC]">
                    {getDiscountBadgeLabel(product)}
                  </Badge>
                ) : null}
              </div>
              <CardTitle className="pt-1.5 text-[1.24rem] font-semibold leading-[1.15] text-[#241B1B] sm:text-[1.36rem] sm:leading-[1.1]">
                <Link
                  href={`/shop/${product.slug}`}
                  className="inline-flex min-h-11 items-center rounded-md hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E2323]/24"
                >
                  {product.name}
                </Link>
              </CardTitle>
              <p className="min-h-[2.8rem] pt-1 text-sm leading-relaxed text-[#3B2F2F]/67 sm:min-h-[3.1rem] lg:min-h-[3.6rem]">
                {product.description}
              </p>
              <ul className="mt-3 flex flex-wrap gap-2 text-xs text-[#3B2F2F]/70">
                <li className="rounded-full border border-[#3B2F2F]/10 bg-white/58 px-2.5 py-1">
                  Fabric: Skin-friendly
                </li>
                <li className="rounded-full border border-[#3B2F2F]/10 bg-white/58 px-2.5 py-1">
                  Use: Daily essential
                </li>
                <li className="rounded-full border border-[#3B2F2F]/10 bg-white/58 px-2.5 py-1">
                  Delivery: Pakistan-wide
                </li>
              </ul>
            </CardHeader>
            <CardFooter className="mt-auto flex flex-col items-stretch justify-between gap-3 border-[#3B2F2F]/8 bg-transparent px-4 py-4 sm:flex-row sm:items-end sm:px-5 lg:min-h-[5.35rem]">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2.5">
                  <span className="text-base font-semibold text-[#2E2323]">
                    {formatPkr(product.pricePkr)}
                  </span>
                  {getDiscountBadgeLabel(product) ? (
                    <span className="text-xs text-[#3B2F2F]/56 line-through">
                      {formatPkr(product.compareAtPricePkr)}
                    </span>
                  ) : null}
                </div>
                <p className="text-[11px] font-medium tracking-[0.08em] text-[#6E2D2D] uppercase">
                  {getAvailabilityLabel(product)}
                </p>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[11.5rem]">
                <AddToCartButton product={product} className="w-full" />
                <Button
                  asChild
                  variant="outline"
                  className="h-10 w-full rounded-full border-[#2E2323]/14 bg-white/72 text-xs font-medium text-[#2E2323]"
                >
                  <Link
                    href={getWhatsappOrderLink(product)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(event) =>
                      void trackAndOpenWhatsapp(event, {
                        whatsappUrl: getWhatsappOrderLink(product),
                        sourcePage: "product_grid",
                        productSlug: product.slug,
                        productName: product.name,
                        category: product.category,
                        pricePkr: product.pricePkr,
                      })
                    }
                  >
                    WhatsApp instead
                  </Link>
                </Button>
              </div>
            </CardFooter>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
