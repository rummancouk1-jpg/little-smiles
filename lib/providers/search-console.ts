// Google Search Console provider scaffold.
//
// This module is a typed contract for FUTURE activation. It deliberately
// does NOT call out to the GSC API today — no SDK is installed and no
// credentials are wired. The goal here is honesty: when an operator opens
// /admin/seo or /admin/readiness, they should see a calm "not connected"
// state with the exact env vars they need to set, not a placeholder
// dashboard pretending to have data.
//
// Activation plan (when the operator is ready):
//   1. Create a Google Cloud service account, enable the Search Console
//      API, download the JSON key.
//   2. Verify the property `https://www.littlesmiles.co/` in Search
//      Console and grant the service-account email read access.
//   3. Set the env vars below in Vercel.
//   4. Install `googleapis` and implement `fetchTopQueries` / others.
//      The shape of the data the wiring expects is fully described by
//      the types in this file, so the diff stays small.

export type GscConnectionState =
  | { connected: false; reason: string; missingEnv: string[] }
  | { connected: true; siteUrl: string; clientEmail: string };

const REQUIRED_ENV: ReadonlyArray<keyof GscEnv> = [
  "GSC_CLIENT_EMAIL",
  "GSC_PRIVATE_KEY",
  "GSC_SITE_URL",
];

type GscEnv = {
  GSC_CLIENT_EMAIL?: string;
  GSC_PRIVATE_KEY?: string;
  GSC_SITE_URL?: string;
};

export function getSearchConsoleConnectionState(): GscConnectionState {
  const env = process.env as GscEnv;
  const missing = REQUIRED_ENV.filter((key) => !env[key]?.trim());

  if (missing.length > 0) {
    return {
      connected: false,
      reason: `Search Console is not connected. Set: ${missing.join(", ")}.`,
      missingEnv: missing,
    };
  }

  return {
    connected: true,
    siteUrl: env.GSC_SITE_URL!.trim(),
    clientEmail: env.GSC_CLIENT_EMAIL!.trim(),
  };
}

// Future-shape types. These describe what the eventual fetcher will return
// so the UI / engines can be written against them today. Until the fetcher
// is implemented, these types exist purely to keep the scaffold honest.

export type GscQueryRow = {
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type GscQueryWindow = {
  /** ISO date inclusive. */
  startDate: string;
  /** ISO date inclusive. */
  endDate: string;
  rows: GscQueryRow[];
};

/**
 * Placeholder. Throws on call because the integration is not yet wired.
 * Wire by installing `googleapis` and replacing this function — the
 * return type is the operator-facing contract.
 */
export async function fetchTopQueries(): Promise<GscQueryWindow> {
  throw new Error(
    "Search Console integration is not yet wired. Install googleapis and replace this function. See lib/providers/search-console.ts header.",
  );
}
