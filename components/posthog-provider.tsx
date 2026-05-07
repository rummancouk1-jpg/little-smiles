"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { getPostHogClient, runWhenIdle } from "@/lib/posthog-client";

type PostHogProviderProps = {
  children: React.ReactNode;
};

export function PostHogProvider({ children }: PostHogProviderProps) {
  const pathname = usePathname();

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;

    let cancelled = false;
    const query = typeof window !== "undefined" ? window.location.search : "";
    const url = query ? `${pathname}?${query}` : pathname;

    runWhenIdle(() => {
      if (cancelled) return;
      void getPostHogClient().then((client) => {
        if (cancelled || !client) return;
        client.capture("$pageview", { $current_url: url });
      });
    });

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return <>{children}</>;
}
