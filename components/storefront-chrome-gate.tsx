"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Renders customer storefront chrome (navbar, footer, cart toast) on every
 * route EXCEPT the private admin, which supplies its own cockpit chrome.
 * Presentation only — no effect on the storefront output for customer routes.
 */
export function StorefrontChromeGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) return null;
  return <>{children}</>;
}
