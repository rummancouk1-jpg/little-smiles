import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
  /** Treemap is written to `.next/analyze/` — open `client.html` locally if no browser opens. */
  openAnalyzer: process.env.CI !== "true",
});

const nextConfig: NextConfig = {
  images: {
    /** Serve modern formats from PNG sources (no asset migration required). */
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
};

export default withBundleAnalyzer(nextConfig);
