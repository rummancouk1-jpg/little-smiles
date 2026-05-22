// Google Analytics 4 Data API provider.
//
// Activation requirements:
//   GA4_PROPERTY_ID    — numeric property ID (not the G- measurement ID)
//   GA4_CLIENT_EMAIL   — service-account email with Viewer access on the property
//   GA4_PRIVATE_KEY    — PEM private key (literal \n escapes are decoded at runtime)
//
// Read-only. Fetcher never writes.

import { BetaAnalyticsDataClient } from "@google-analytics/data";

import { logSeo } from "@/lib/seo-intelligence/logger";

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

type Ga4LikeValue = { value?: string | null };
type Ga4LikeRow = {
  dimensionValues?: ReadonlyArray<Ga4LikeValue> | null;
  metricValues?: ReadonlyArray<Ga4LikeValue> | null;
};

/** Defensive runtime validation. Drops malformed rows, surfaces issues as warnings. */
function validateAndShape(
  rawRows: ReadonlyArray<unknown>,
): { rows: Ga4PagePathRow[]; droppedCount: number; droppedReasons: string[] } {
  const droppedReasons: string[] = [];
  const rows: Ga4PagePathRow[] = [];

  for (const raw of rawRows) {
    if (!raw || typeof raw !== "object") {
      droppedReasons.push("non_object_row");
      continue;
    }
    const row = raw as Ga4LikeRow;
    const dims = (row.dimensionValues ?? []) as ReadonlyArray<Ga4LikeValue>;
    const mets = (row.metricValues ?? []) as ReadonlyArray<Ga4LikeValue>;
    const pagePath = typeof dims[0]?.value === "string" ? dims[0].value : "";
    if (pagePath.length === 0) {
      droppedReasons.push("empty_page_path");
      continue;
    }
    const sessions = parseMetric(mets[0]?.value);
    const totalUsers = parseMetric(mets[1]?.value);
    const averageSessionDurationSeconds = parseMetric(mets[2]?.value);
    const bounceRate = parseMetric(mets[3]?.value);
    // Cap pathological bounce rates (GA4 occasionally returns >1 for tiny samples).
    const normalisedBounce = bounceRate < 0 ? 0 : bounceRate > 1 ? 1 : bounceRate;
    rows.push({
      pagePath,
      sessions,
      totalUsers,
      averageSessionDurationSeconds,
      bounceRate: normalisedBounce,
    });
  }

  return { rows, droppedCount: droppedReasons.length, droppedReasons };
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

  const startedAt = Date.now();
  logSeo("GA4_FETCH_START", {
    propertyId,
    windowStart: options.startDate,
    windowEnd: options.endDate,
    limit,
    timeoutMs,
  });

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

    if (!response || typeof response !== "object") {
      logSeo("GA4_FETCH_FAILED", { reason: "empty_response", elapsedMs: Date.now() - startedAt });
      return { ok: false, reason: "GA4 returned an empty response object." };
    }

    const rawRows = Array.isArray(response.rows) ? response.rows : [];
    const { rows, droppedCount, droppedReasons } = validateAndShape(rawRows);

    if (droppedCount > 0) {
      logSeo("GA4_VALIDATION_WARNING", {
        droppedCount,
        sampleReasons: droppedReasons.slice(0, 5),
        keptCount: rows.length,
      });
    }

    logSeo("GA4_FETCH_SUCCESS", {
      propertyId,
      rowCount: rows.length,
      droppedCount,
      windowStart: options.startDate,
      windowEnd: options.endDate,
      elapsedMs: Date.now() - startedAt,
    });

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
    logSeo("GA4_FETCH_FAILED", {
      reason,
      elapsedMs: Date.now() - startedAt,
      windowStart: options.startDate,
      windowEnd: options.endDate,
    });
    return { ok: false, reason };
  }
}
