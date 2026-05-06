import type { Metadata } from "next";
import {
  Cormorant_Garamond,
  Geist_Mono,
  Plus_Jakarta_Sans,
} from "next/font/google";
import { products } from "@/lib/products";
import { validateProductImagesOnServer } from "@/lib/validate-product-images.server";
import { Navbar } from "@/components/navbar";
import { PostHogProvider } from "@/components/posthog-provider";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";

const bodySans = Plus_Jakarta_Sans({
  variable: "--font-body-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const editorialSerif = Cormorant_Garamond({
  variable: "--font-editorial-serif",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.littlesmiles.co"),
  title: {
    default: "Little Smiles | Premium Baby Boutique Pakistan",
    template: "%s | Little Smiles",
  },
  description:
    "Shop premium baby essentials in Pakistan, including swaddles, bodysuits, food bags, and bottle cases.",
  openGraph: {
    title: "Little Smiles | Premium Baby Boutique Pakistan",
    description:
      "Parent-loved baby essentials for comfort, gifting, and everyday use.",
    type: "website",
    locale: "en_PK",
    url: "https://www.littlesmiles.co",
    siteName: "Little Smiles",
    images: [
      {
        url: "/products/logo.png",
        width: 240,
        height: 96,
        alt: "Little Smiles",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Little Smiles | Premium Baby Boutique Pakistan",
    description:
      "Parent-loved baby essentials for comfort, gifting, and everyday use.",
    images: ["/products/logo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  validateProductImagesOnServer(products);

  return (
    <html
      lang="en"
      className={`${bodySans.variable} ${geistMono.variable} ${editorialSerif.variable} h-full antialiased`}
    >
      <body className="grain-surface min-h-full flex flex-col">
        <PostHogProvider>
          <Navbar />
          <div className="flex-1">{children}</div>
          <SiteFooter />
        </PostHogProvider>
      </body>
    </html>
  );
}
