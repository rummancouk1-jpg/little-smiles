// Google Analytics 4 Data API provider.
//
// Activation requirements:
//   GA4_PROPERTY_ID    — numeric property ID (not the G- measurement ID)
//   GA4_CLIENT_EMAIL   — service-account email with Viewer access on the property
//   GA4_PRIVATE_KEY    — PEM private key (literal \n escapes are decoded at runtime)
//
// Read-only. Fetcher never writes.

import { BetaAnalyticsDataClient } from "@google-analytics/data";

const DEFAULT_LIMIT = 200;
const DEFAULT_TIMEOUT_MS = 25_000;

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
  averageSessionDurationSeconds: number;
  bounceRate: number;
};

export type Ga4PagePathWindow = {
  startDate: string;
  endDate: string;
  rows: Ga4PagePathRow[];
};

export type Ga4FetchOptions = {
  startDate: string;
  endDate: string;
  limit?: number;
  timeoutMs?: number;
};

export type Ga4FetchResult =
  | { ok: true; window: Ga4PagePathWindow }
  | { ok: false; reason: string };

function decodePrivateKey(raw: string): string {
  return raw.replace(/\\n/g, "\n");
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

function parseMetric(raw: string | null | undefined): number {
  if (raw == null) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export async function fetchTopPagePaths(options: Ga4FetchOptions): Promise<Ga4FetchResult> {
  const state = getGa4ConnectionState();
  if (!state.connected) {
    return { ok: false, reason: state.reason };
  }

  const env = process.env as Ga4Env;
  const clientEmail = env.GA4_CLIENT_EMAIL!.trim();
  const privateKey = decodePrivateKey(env.GA4_PRIVATE_KEY!.trim());
  const propertyId = env.GA4_PROPERTY_ID!.trim();
  const limit = options.limit ?? DEFAULT_LIMIT;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  try {
    const client = new BetaAnalyticsDataClient({
      credentials: { client_email: clientEmail, private_key: privateKey },
    });

    const [response] = await withTimeout(
      client.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate: options.startDate, endDate: options.endDate }],
        dimensions: [{ name: "pagePath" }],
        metrics: [
          { name: "sessions" },
          { name: "totalUsers" },
          { name: "averageSessionDuration" },
          { name: "bounceRate" },
        ],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: String(limit),
      }),
      timeoutMs,
      "GA4 fetch",
    );

    const rawRows = response.rows ?? [];
    const rows: Ga4PagePathRow[] = rawRows
      .map((row) => {
        const dims = row.dimensionValues ?? [];
        const mets = row.metricValues ?? [];
        const pagePath = typeof dims[0]?.value === "string" ? dims[0].value : "";
        return {
          pagePath,
          sessions: parseMetric(mets[0]?.value),
          totalUsers: parseMetric(mets[1]?.value),
          averageSessionDurationSeconds: parseMetric(mets[2]?.value),
          bounceRate: parseMetric(mets[3]?.value),
        };
      })
      .filter((row) => row.pagePath.length > 0);

    return {
      ok: true,
      window: {
        startDate: options.startDate,
        endDate: options.endDate,
        rows,
      },
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Unknown GA4 error";
    return { ok: false, reason };
  }
}
