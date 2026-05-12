import type { Metadata } from "next";

import { TrackOrderForm } from "@/components/track-order-form";
import { staticPageMetadata } from "@/lib/seo-metadata";

export const metadata: Metadata = staticPageMetadata({
  // Page-segment title only; the root layout template wraps it with
  // "| Little Smiles" — keeping a brand suffix here causes the final
  // <title> to be "Track Order | Little Smiles Pakistan | Little Smiles".
  title: "Track Order",
  description:
    "Track your Little Smiles order status using your order ID and phone number used during confirmation.",
  path: "/track-order",
});

export default function TrackOrderPage() {
  return (
    <main className="min-h-screen bg-[#FDF8F4] px-4 py-10 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-3xl space-y-5">
        <header className="rounded-3xl border border-[#3B2F2F]/10 bg-white/88 p-6 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-8">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#3B2F2F]/50">Little Smiles Support</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#1F1918] sm:text-4xl">Track your order</h1>
          <p className="mt-2 text-sm leading-relaxed text-[#3B2F2F]/72">
            Enter your order reference and phone number to check the latest status, dispatch update, and tracking details.
          </p>
        </header>

        <TrackOrderForm />
      </section>
    </main>
  );
}
