import type { Metadata, Viewport } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
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

/* Golden Hour display serif. ONE variable file (replaces Cormorant's three
   static weights). SOFT axis loaded so headings can carry the storybook
   roundness (set via font-variation-settings in globals.css); opsz is
   applied automatically by the browser. */
const displaySerif = Fraunces({
  variable: "--font-display-serif",
  subsets: ["latin"],
  weight: "variable",
  axes: ["SOFT", "opsz"],
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
  other: {
    "p:domain_verify": "c3557302204ad4b3f5163e017298af98",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  validateProductImagesOnServer(products);

  const sitewideStructuredData = organizationAndWebsiteJsonLd();

  return (
    <html
      lang="en-PK"
      suppressHydrationWarning
      className={`${bodySans.variable} ${displaySerif.variable} h-full antialiased`}
    >
      <body className="grain-surface min-h-full flex flex-col">
        {/* Set the theme before paint (no flash-of-wrong-theme). Stored choice
            wins; otherwise follow the device's prefers-color-scheme. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('theme');var d=t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();",
          }}
        />
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
