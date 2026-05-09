import { formatPkr, productUrl, type Product } from "@/lib/products";
import { whatsappBaseUrl } from "@/lib/products";

export type CartCheckoutLine = {
  product: Product;
  quantity: number;
};

/** Collected on /cart only — not stored in localStorage. */
export type CartCheckoutCustomerDetails = {
  fullName: string;
  phone: string;
  city: string;
  address: string;
  note: string;
};

export function cartSubtotalPkr(lines: CartCheckoutLine[]): number {
  return lines.reduce((sum, line) => sum + line.product.pricePkr * line.quantity, 0);
}

export function buildCartWhatsappCheckoutMessage(
  lines: CartCheckoutLine[],
  customer: CartCheckoutCustomerDetails,
): string {
  const subtotal = cartSubtotalPkr(lines);
  const blocks: string[] = [
    "Hi Little Smiles,",
    "",
    "COD ORDER — please confirm on WhatsApp:",
    "",
    "CUSTOMER",
    `• Name: ${customer.fullName.trim()}`,
    `• Phone: ${customer.phone.trim()}`,
    `• City: ${customer.city.trim()}`,
    `• Address: ${customer.address.trim()}`,
  ];

  const note = customer.note.trim();
  if (note.length > 0) {
    blocks.push(`• Note: ${note}`);
  }

  blocks.push("", "ORDER LINES", "");

  lines.forEach((line, index) => {
    const { product, quantity } = line;
    const lineTotal = product.pricePkr * quantity;
    blocks.push(
      `${index + 1}. ${product.name}`,
      `   • Category: ${product.category}`,
      `   • Qty: ${quantity}`,
      `   • Unit price: ${formatPkr(product.pricePkr)}`,
      `   • Line total: ${formatPkr(lineTotal)}`,
      `   • Product URL: ${productUrl(product)}`,
      "",
    );
  });

  blocks.push(
    `Cart subtotal: ${formatPkr(subtotal)}`,
    "",
    "SETTLEMENT",
    "• Shipping fee: to be confirmed after city/address",
    "• Final total (including delivery): confirmed before dispatch",
    "• Payment: Cash on Delivery (COD) — no online payment required",
    "",
    "Please confirm stock, delivery fee, and final amount on WhatsApp before dispatch.",
    "",
    "Thank you — Little Smiles",
  );

  return blocks.join("\n");
}

export function getCartWhatsappCheckoutUrl(
  lines: CartCheckoutLine[],
  customer: CartCheckoutCustomerDetails,
): string {
  const text = buildCartWhatsappCheckoutMessage(lines, customer);
  return `${whatsappBaseUrl}?text=${encodeURIComponent(text)}`;
}
