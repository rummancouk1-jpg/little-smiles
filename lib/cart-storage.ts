/** Versioned key — bump suffix if stored shape changes (migration resets old carts). */
export const CART_STORAGE_KEY = "little-smiles-cart-v1";

export type CartLineStored = {
  productSlug: string;
  quantity: number;
};

function isCartLineStored(value: unknown): value is CartLineStored {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.productSlug === "string" &&
    row.productSlug.length > 0 &&
    typeof row.quantity === "number" &&
    Number.isFinite(row.quantity) &&
    row.quantity >= 1
  );
}

/**
 * Parse localStorage JSON safely. Returns [] on corruption or unknown shape.
 */
export function parseCartFromStorage(raw: string | null): CartLineStored[] {
  if (raw == null || raw.trim() === "") return [];
  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    return data.filter(isCartLineStored).map((line) => ({
      productSlug: line.productSlug.trim(),
      quantity: Math.floor(line.quantity),
    }));
  } catch {
    return [];
  }
}

export function serializeCart(lines: CartLineStored[]): string {
  return JSON.stringify(lines);
}
