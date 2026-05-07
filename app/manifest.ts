import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site";

/**
 * Web app manifest — Android “Add to Home Screen”, theme color in Chrome, bookmark tiles.
 * Icons reference file-based `app/icon.png` + `app/apple-icon.png` (stable URLs on deploy).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Little Smiles | Premium Baby Boutique Pakistan",
    short_name: "Little Smiles",
    description:
      "Premium baby essentials in Pakistan — swaddles, bodysuits, feeding gear, and gifts.",
    id: siteUrl,
    start_url: "/",
    scope: "/",
    display: "browser",
    orientation: "portrait-primary",
    background_color: "#FDF8F4",
    theme_color: "#2F2624",
    icons: [
      {
        src: `${siteUrl}/icon.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `${siteUrl}/icon.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: `${siteUrl}/apple-icon.png`,
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
