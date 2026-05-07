import { Suspense } from "react";
import Script from "next/script";

import { GoogleAnalyticsPageView } from "@/components/google-analytics-page-view";

function isValidGaId(id: string): boolean {
  return /^G-[A-Z0-9]+$/i.test(id.trim());
}

/**
 * GA4 via `next/script` (`afterInteractive`). Skips rendering when unset or invalid (production-safe).
 * See: https://nextjs.org/docs/app/building-your-application/optimizing/scripts
 */
export function GoogleAnalytics() {
  const raw = process.env.NEXT_PUBLIC_GA_ID;
  const gaId = typeof raw === "string" ? raw.trim() : "";

  if (!gaId || !isValidGaId(gaId)) {
    return null;
  }

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
        strategy="afterInteractive"
      />
      <Script id="ga-gtag-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${gaId}', {
            send_page_view: true
          });
        `}
      </Script>
      <Suspense fallback={null}>
        <GoogleAnalyticsPageView gaId={gaId} />
      </Suspense>
    </>
  );
}
