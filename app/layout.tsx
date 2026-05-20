import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Plus_Jakarta_Sans } from "next/font/google";
import { organizationAndWebsiteJsonLd } from "@/lib/json-ld";
import { products } from "@/lib/products";
import { siteUrl } from "@/lib/site";
import { validateProductImagesOnServer } from "@/lib/validate-product-images.server";
import { GoogleAnalytics } from "@/components/google-analytics";
import { CartProvider } from "@/components/cart-provider";
import { CartToast } from "@/components/cart-toast";
import { Navbar } from "@/components/navbar";
import { PostHogProvider } from "@/components/posthog-provider";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";

const bodySans = Plus_Jakarta_Sans({
  variable: "--font-body-sans",
  subsets: ["latin"],
  display: "swap",
});

const editorialSerif = Cormorant_Garamond({
  variable: "--font-editorial-serif",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

/** Enables `env(safe-area-inset-*)` on notched iPhones / edge Android when in standalone / browser chrome. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Little Smiles | Premium Baby Boutique Pakistan",
    template: "%s | Little Smiles",
  },
  description:
    "Shop premium baby essentials in Pakistan, including swaddles, bodysuits, food bags, and bottle cases.",
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  openGraph: {
    title: "Little Smiles | Premium Baby Boutique Pakistan",
    description:
      "Parent-loved baby essentials for comfort, gifting, and everyday use.",
    type: "website",
    locale: "en_PK",
    url: siteUrl,
    siteName: "Little Smiles",
  },
  twitter: {
    card: "summary_large_image",
    title: "Little Smiles | Premium Baby Boutique Pakistan",
    description:
      "Parent-loved baby essentials for comfort, gifting, and everyday use.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  validateProductImagesOnServer(products);

  const sitewideStructuredData = organizationAndWebsiteJsonLd();

  // Preconnect to Supabase Storage so the first hero image on /blog/*
  // shaves DNS + TLS setup off LCP. Only emit when the env is present;
  // adding a preconnect to a non-existent host is wasted work.
  let supabaseOrigin: string | null = null;
  const rawSupabase = process.env.SUPABASE_URL?.trim();
  if (rawSupabase) {
    try {
      supabaseOrigin = new URL(rawSupabase).origin;
    } catch {
      supabaseOrigin = null;
    }
  }

  return (
    <html
      lang="en-PK"
      className={`${bodySans.variable} ${editorialSerif.variable} h-full antialiased`}
    >
      <head>
        {supabaseOrigin ? (
          <>
            <link rel="preconnect" href={supabaseOrigin} crossOrigin="" />
            <link rel="dns-prefetch" href={supabaseOrigin} />
          </>
        ) : null}
      </head>
      <body className="grain-surface min-h-full flex flex-col">
        <GoogleAnalytics />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(sitewideStructuredData) }}
        />
        <PostHogProvider>
          <CartProvider>
            <Navbar />
            <div className="flex-1">{children}</div>
            <CartToast />
            <SiteFooter />
          </CartProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
