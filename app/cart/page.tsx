import type { Metadata } from "next";

import { CartPageClient } from "@/components/cart-page-client";

export const metadata: Metadata = {
  title: "Your cart",
  description:
    "Review your Little Smiles cart and complete your order on WhatsApp with a prefilled message.",
  robots: {
    index: false,
    follow: true,
    googleBot: { index: false, follow: true },
  },
};

export default function CartPage() {
  return <CartPageClient />;
}
