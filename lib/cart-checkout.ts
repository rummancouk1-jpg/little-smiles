import { formatPkr, productUrl, type Product } from "@/lib/products";
import { whatsappBaseUrl } from "@/lib/products";

export type CartCheckoutLine = {
  product: Product;
  quantity: number;
};

export function cartSubtotalPkr(lines: CartCheckoutLine[]): number {
  return lines.reduce((sum, line) => sum + line.product.pricePkr * line.quantity, 0);
}

export function buildCartWhatsappCheckoutMessage(lines: CartCheckoutLine[]): string {
  const subtotal = cartSubtotalPkr(lines);
  const blocks: string[] = [
    "Hi Little Smiles,",
    "",
    "CART ORDER — please confirm stock, pricing, and delivery:",
    "",
  ];

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
    `Subtotal: ${formatPkr(subtotal)}`,
    "",
    "Customer note: [Please add variant/size, city, phone, and any delivery preferences]",
    "",
    "Pakistan delivery — reply with confirmation and payment details if needed.",
  );

  return blocks.join("\n");
}

export function getCartWhatsappCheckoutUrl(lines: CartCheckoutLine[]): string {
  const text = buildCartWhatsappCheckoutMessage(lines);
  return `${whatsappBaseUrl}?text=${encodeURIComponent(text)}`;
}
