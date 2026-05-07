import type { Metadata } from "next";

import { siteUrl } from "@/lib/site";

/**
 * Static route metadata: canonical, OG, Twitter, explicit indexability.
 * Page `title` should be the segment only — root layout template adds ` | Little Smiles`.
 */
export function staticPageMetadata(input: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  const canonical = `${siteUrl}${input.path}`;
  const socialTitle = `${input.title} | Little Smiles`;

  return {
    title: input.title,
    description: input.description,
    alternates: { canonical },
    openGraph: {
      title: socialTitle,
      description: input.description,
      url: canonical,
      type: "website",
      locale: "en_PK",
      siteName: "Little Smiles",
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description: input.description,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true },
    },
  };
}
