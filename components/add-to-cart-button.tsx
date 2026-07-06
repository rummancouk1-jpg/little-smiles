"use client";

import { ShoppingBag } from "lucide-react";

import { useCart } from "@/components/cart-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Product } from "@/lib/products";

type Variant = "primary" | "outline" | "ghost";

type Props = {
  product: Product;
  quantity?: number;
  variant?: Variant;
  size?: "default" | "sm";
  className?: string;
  label?: string;
  showIcon?: boolean;
};

export function AddToCartButton({
  product,
  quantity = 1,
  variant = "primary",
  size = "default",
  className,
  label = "Add to cart",
  showIcon = true,
}: Props) {
  const { addToCart } = useCart();

  const disabled = !product.inStock || product.inventoryQty <= 0;

  const handleClick = () => {
    if (disabled) return;
    addToCart(product, quantity);
  };

  const uiVariant =
    variant === "outline" ? "outline" : variant === "ghost" ? "ghost" : "default";

  return (
    <Button
      type="button"
      variant={uiVariant}
      size={size === "sm" ? "sm" : "default"}
      className={cn(
        "gap-2 rounded-full font-medium",
        variant === "primary" &&
          "h-12 border-transparent bg-ink-walnut px-5 text-ink-foreground shadow-[0_14px_32px_-20px_rgba(47,38,36,0.56)] hover:bg-ink-espresso sm:h-10",
        variant === "outline" &&
          "h-12 border-ink-walnut/16 bg-white/72 text-ink-walnut sm:h-10",
        variant === "ghost" && "h-11 text-ink-walnut",
        className,
      )}
      disabled={disabled}
      onClick={handleClick}
      aria-label={label}
    >
      {showIcon ? <ShoppingBag className="size-4 shrink-0" aria-hidden /> : null}
      {label}
    </Button>
  );
}
