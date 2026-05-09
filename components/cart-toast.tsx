"use client";

import { X } from "lucide-react";
import { useCart } from "@/components/cart-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CartToast() {
  const { toastMessage, dismissToast } = useCart();

  if (!toastMessage) return null;

  return (
    <div
      className={cn(
        "fixed bottom-6 left-1/2 z-[100] w-[min(92vw,24rem)] -translate-x-1/2",
        "animate-in fade-in slide-in-from-bottom-4 duration-300",
      )}
      role="status"
      aria-live="polite"
    >
      <div
        className={cn(
          "flex items-start gap-3 rounded-2xl border border-border/60 bg-card/95 px-4 py-3 shadow-lg backdrop-blur",
        )}
      >
        <p className="flex-1 text-sm leading-snug text-foreground">{toastMessage}</p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-[#3B2F2F]/65 hover:text-[#2E2323]"
          onClick={dismissToast}
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
