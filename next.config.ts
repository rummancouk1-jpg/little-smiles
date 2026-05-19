import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";
import { withSentryConfig } from "@sentry/nextjs";

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
    /**
     * Allow next/image optimization for blog hero / thumbnail / section
     * images served from Supabase Storage public buckets. Pattern is
     * scoped to any direct subdomain of supabase.co so it covers the
     * Little Smiles project bucket without coupling the build to env
     * vars. Tighten to the specific project hostname if/when this ever
     * gets pointed at a self-hosted Supabase.
     */
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
};

const analyzedConfig = withBundleAnalyzer(nextConfig);

export default withSentryConfig(analyzedConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
});
