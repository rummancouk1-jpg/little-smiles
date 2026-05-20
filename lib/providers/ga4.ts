// Google Analytics 4 (Data API) provider scaffold.
//
// Today the site uses the client-side GA4 tag for pageview collection
// (NEXT_PUBLIC_GA_ID). To READ traffic data server-side — to power
// "traffic decay" or "rising pages" signals — we need the GA4 Data API.
// That requires a service-account credential separate from the public
// measurement ID.
//
// Activation plan:
//   1. In the same Google Cloud project as the Search Console service
//      account, enable the "Google Analytics Data API".
//   2. In GA4, grant the service-account email Viewer access on the
//      property.
//   3. Set the env vars below in Vercel.
//   4. Install `@google-analytics/data` and implement the fetchers.

export type Ga4ConnectionState =
  | { connected: false; reason: string; missingEnv: string[] }
  | { connected: true; propertyId: string; clientEmail: string };

const REQUIRED_ENV: ReadonlyArray<keyof Ga4Env> = [
  "GA4_PROPERTY_ID",
  "GA4_CLIENT_EMAIL",
  "GA4_PRIVATE_KEY",
];

type Ga4Env = {
  GA4_PROPERTY_ID?: string;
  GA4_CLIENT_EMAIL?: string;
  GA4_PRIVATE_KEY?: string;
};

export function getGa4ConnectionState(): Ga4ConnectionState {
  const env = process.env as Ga4Env;
  const missing = REQUIRED_ENV.filter((key) => !env[key]?.trim());

  if (missing.length > 0) {
    return {
      connected: false,
      reason: `GA4 Data API is not connected. Set: ${missing.join(", ")}.`,
      missingEnv: missing,
    };
  }

  return {
    connected: true,
    propertyId: env.GA4_PROPERTY_ID!.trim(),
    clientEmail: env.GA4_CLIENT_EMAIL!.trim(),
  };
}

export type Ga4PagePathRow = {
  pagePath: string;
  sessions: number;
  totalUsers: number;
  averageEngagementTimeSeconds: number;
};

export type Ga4PagePathWindow = {
  startDate: string;
  endDate: string;
  rows: Ga4PagePathRow[];
};

export async function fetchTopPagePaths(): Promise<Ga4PagePathWindow> {
  throw new Error(
    "GA4 Data API integration is not yet wired. Install @google-analytics/data and replace this function. See lib/providers/ga4.ts header.",
  );
}
