"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Sends GA4 `config` on client-side route changes. The first full page load is
 * covered by `send_page_view` in `google-analytics.tsx` — we skip one effect
 * run to avoid duplicate `page_view` on hydration.
 */
export function GoogleAnalyticsPageView({ gaId }: { gaId: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const skipNextConfig = useRef(true);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.gtag !== "function") {
      return;
    }

    const query = searchParams?.toString();
    const pagePath = query ? `${pathname}?${query}` : pathname;

    if (skipNextConfig.current) {
      skipNextConfig.current = false;
      return;
    }

    window.gtag("config", gaId, {
      page_path: pagePath,
    });
  }, [pathname, searchParams, gaId]);

  return null;
}
