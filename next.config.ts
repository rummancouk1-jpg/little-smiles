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
     * Allow next/image optimization for the small set of hosts the
     * editorial pipeline trusts. Relative paths (e.g. `/images/blog/...`)
     * never need a pattern and should be preferred for static assets
     * checked into `public/`.
     *
     * Hosts allowed:
     *   - `*.supabase.co`         Supabase Storage public buckets
     *                             (managed uploads via the admin API)
     *   - `littlesmiles.co` /
     *     `www.littlesmiles.co`   Primary live domain — covers any
     *                             legacy `<host>/images/...` URLs in
     *                             seed data or external editorial drops
     *   - `littlesmiles.pk` /
     *     `www.littlesmiles.pk`   Local PK domain alias — same purpose
     *
     * Anything outside this list will fail next/image's hostname check;
     * the SafeImage helper at components/contentops/safe-image.tsx
     * intercepts those URLs and renders a calm placeholder instead of
     * crashing the page. Add a hostname here AND keep SafeImage in the
     * call chain when adding a new trusted source.
     */
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "littlesmiles.co" },
      { protocol: "https", hostname: "www.littlesmiles.co" },
      { protocol: "https", hostname: "littlesmiles.pk" },
      { protocol: "https", hostname: "www.littlesmiles.pk" },
    ],
  },
};

const analyzedConfig = withBundleAnalyzer(nextConfig);

export default withSentryConfig(analyzedConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
});
