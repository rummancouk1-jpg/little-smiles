"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  clampOrderQuantity,
  getProductBySlug,
  type Product,
} from "@/lib/products";
import {
  CART_STORAGE_KEY,
  parseCartFromStorage,
  serializeCart,
  type CartLineStored,
} from "@/lib/cart-storage";

export type ResolvedCartLine = {
  productSlug: string;
  quantity: number;
  product: Product;
};

function mergeAndSanitizeLines(lines: CartLineStored[]): CartLineStored[] {
  const bySlug = new Map<string, number>();
  for (const line of lines) {
    const slug = line.productSlug.trim();
    if (!slug) continue;
    const product = getProductBySlug(slug);
    if (!product || !product.inStock || product.inventoryQty <= 0) continue;
    const qty = clampOrderQuantity(product, Math.floor(line.quantity));
    if (qty < 1) continue;
    const prev = bySlug.get(slug) ?? 0;
    bySlug.set(slug, clampOrderQuantity(product, prev + qty));
  }
  return Array.from(bySlug.entries()).map(([productSlug, quantity]) => ({
    productSlug,
    quantity,
  }));
}

type CartContextValue = {
  /** Raw persisted lines after sanitization */
  items: CartLineStored[];
  /** Lines with live catalog products (empty if slug invalid) */
  resolvedLines: ResolvedCartLine[];
  /** True after localStorage has been read (avoids badge flash on first paint). */
  isCartReady: boolean;
  addToCart: (product: Product, quantity?: number) => { ok: boolean; reason?: string };
  setQuantity: (slug: string, quantity: number) => void;
  removeLine: (slug: string) => void;
  clearCart: () => void;
  totalQuantity: number;
  subtotalPkr: number;
  toastMessage: string | null;
  dismissToast: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartLineStored[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismissToast = useCallback(() => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = null;
    setToastMessage(null);
  }, []);

  const showToast = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMessage(message);
    toastTimer.current = setTimeout(() => {
      setToastMessage(null);
      toastTimer.current = null;
    }, 3200);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    const parsed = parseCartFromStorage(raw);
    const next = mergeAndSanitizeLines(parsed);
    setItems(next);
    if (raw && parsed.length > 0 && next.length < parsed.length) {
      try {
        localStorage.setItem(CART_STORAGE_KEY, serializeCart(next));
      } catch {
        /* ignore */
      }
      const dropped = parsed.length - next.length;
      showToast(
        dropped === 1
          ? "1 item is no longer available and was removed from your cart"
          : `${dropped} items are no longer available and were removed from your cart`,
      );
    }
    setHydrated(true);
  }, [showToast]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(CART_STORAGE_KEY, serializeCart(items));
    } catch {
      /* quota / private mode */
    }
  }, [items, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      setItems((prev) => {
        const next = mergeAndSanitizeLines(prev);
        const dropped = prev.length - next.length;
        if (dropped > 0) {
          showToast(
            dropped === 1
              ? "1 item is no longer available and was removed from your cart"
              : `${dropped} items are no longer available and were removed from your cart`,
          );
        }
        return next;
      });
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [hydrated, showToast]);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const resolvedLines = useMemo((): ResolvedCartLine[] => {
    const out: ResolvedCartLine[] = [];
    for (const line of items) {
      const product = getProductBySlug(line.productSlug);
      if (!product) continue;
      if (!product.inStock || product.inventoryQty <= 0) continue;
      const quantity = clampOrderQuantity(product, line.quantity);
      if (quantity < 1) continue;
      out.push({ productSlug: line.productSlug, quantity, product });
    }
    return out;
  }, [items]);

  const totalQuantity = useMemo(
    () => resolvedLines.reduce((sum, l) => sum + l.quantity, 0),
    [resolvedLines],
  );

  const subtotalPkr = useMemo(
    () =>
      resolvedLines.reduce(
        (sum, l) => sum + l.product.pricePkr * l.quantity,
        0,
      ),
    [resolvedLines],
  );

  const addToCart = useCallback(
    (product: Product, quantity = 1) => {
      if (!product.inStock || product.inventoryQty <= 0) {
        return { ok: false as const, reason: "out_of_stock" };
      }
      const addQty = clampOrderQuantity(product, quantity);
      if (addQty < 1) {
        return { ok: false as const, reason: "invalid_quantity" };
      }
      setItems((prev) => {
        const next = [...prev];
        const idx = next.findIndex((l) => l.productSlug === product.slug);
        if (idx >= 0) {
          next[idx] = {
            productSlug: product.slug,
            quantity: clampOrderQuantity(
              product,
              next[idx].quantity + addQty,
            ),
          };
        } else {
          next.push({ productSlug: product.slug, quantity: addQty });
        }
        return mergeAndSanitizeLines(next);
      });
      showToast(`Added “${product.name}” to cart`);
      return { ok: true as const };
    },
    [showToast],
  );

  const setQuantity = useCallback((slug: string, quantity: number) => {
    setItems((prev) => {
      const product = getProductBySlug(slug);
      if (!product) return mergeAndSanitizeLines(prev.filter((l) => l.productSlug !== slug));
      const q = clampOrderQuantity(product, Math.floor(quantity));
      if (q < 1) {
        return mergeAndSanitizeLines(prev.filter((l) => l.productSlug !== slug));
      }
      return mergeAndSanitizeLines(
        prev.map((l) =>
          l.productSlug === slug ? { productSlug: slug, quantity: q } : l,
        ),
      );
    });
  }, []);

  const removeLine = useCallback((slug: string) => {
    setItems((prev) => mergeAndSanitizeLines(prev.filter((l) => l.productSlug !== slug)));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const value = useMemo(
    () => ({
      items,
      resolvedLines,
      isCartReady: hydrated,
      addToCart,
      setQuantity,
      removeLine,
      clearCart,
      totalQuantity,
      subtotalPkr,
      toastMessage,
      dismissToast,
    }),
    [
      items,
      resolvedLines,
      hydrated,
      addToCart,
      setQuantity,
      removeLine,
      clearCart,
      totalQuantity,
      subtotalPkr,
      toastMessage,
      dismissToast,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within CartProvider");
  }
  return ctx;
}
