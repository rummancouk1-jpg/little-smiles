/** Production site origin — single source of truth for canonical URLs and JSON-LD. */
export const siteUrl = "https://www.littlesmiles.co" as const;

/** Default OG/Twitter image path (resolved via metadataBase). Prefer a 1200×630 branded asset long-term. */
export const defaultOgImagePath = "/products/logo.png";

export function absoluteUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${siteUrl}${normalized}`;
}
