"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ShoppingBag } from "lucide-react";

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
  // Presentation-only confirmation: after a successful add, the button briefly
  // morphs to a "✓ Added" state, then returns. The add itself is unchanged.
  const [added, setAdded] = useState(false);
  // Remount key for the check overlay so the draw-in replays on every add,
  // even rapid repeats within the "Added" window.
  const [popKey, setPopKey] = useState(0);
  const addedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (addedTimer.current) clearTimeout(addedTimer.current);
    },
    [],
  );

  const disabled = !product.inStock || product.inventoryQty <= 0;

  const handleClick = () => {
    if (disabled) return;
    const result = addToCart(product, quantity);
    if (!result?.ok) return;
    setAdded(true);
    setPopKey((key) => key + 1);
    if (addedTimer.current) clearTimeout(addedTimer.current);
    addedTimer.current = setTimeout(() => setAdded(false), 1400);
  };

  const uiVariant =
    variant === "outline" ? "outline" : variant === "ghost" ? "ghost" : "default";

  return (
    <Button
      type="button"
      variant={uiVariant}
      size={size === "sm" ? "sm" : "default"}
      className={cn(
        "relative gap-2 rounded-full font-medium",
        // Marigold owns the primary commerce action (Golden Hour) — every
        // add-to-cart is marigold by default; call sites no longer override.
        variant === "primary" &&
          "h-12 border-transparent bg-accent-marigold px-5 text-accent-marigold-ink shadow-cta hover:bg-accent-marigold-deep [a]:hover:bg-accent-marigold-deep sm:h-10",
        variant === "outline" &&
          "h-12 border-ink-walnut/16 bg-surface-raised/72 text-ink-walnut sm:h-10",
        variant === "ghost" && "h-11 text-ink-walnut",
        // One-shot success delight: press-pop + marigold glow (globals.css);
        // motion-gated, the cross-fade below carries the state without it.
        added && "cart-added-pop",
        className,
      )}
      disabled={disabled}
      onClick={handleClick}
      aria-label={label}
    >
      {/* In-flow label defines the button width, so the morph never shifts
          layout — the success state is an absolute overlay that cross-fades. */}
      <span
        className={cn(
          "inline-flex items-center gap-2 transition-opacity duration-200 motion-reduce:transition-none",
          added && "opacity-0",
        )}
      >
        {showIcon ? <ShoppingBag className="size-4 shrink-0" aria-hidden /> : null}
        {label}
      </span>
      <span
        key={popKey}
        aria-hidden
        className={cn(
          "absolute inset-0 inline-flex items-center justify-center gap-2 transition-opacity duration-200 motion-reduce:transition-none",
          added ? "opacity-100" : "opacity-0",
          added && "cart-added-check",
        )}
      >
        <Check className="size-4 shrink-0" strokeWidth={2.5} aria-hidden />
        Added
      </span>
    </Button>
  );
}
