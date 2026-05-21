// Google Search Console provider.
//
// Activation requirements:
//   GSC_SITE_URL      — exact property URL (trailing slash matches GSC)
//   GSC_CLIENT_EMAIL  — service-account email with Restricted access on the property
//   GSC_PRIVATE_KEY   — PEM private key (literal \n escapes are decoded at runtime)
//
// All reads are scoped to webmasters.readonly. Fetcher never writes.

import { google } from "googleapis";

const SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly"];

const DEFAULT_ROW_LIMIT = 200;
const DEFAULT_TIMEOUT_MS = 25_000;

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

export type GscFetchOptions = {
  startDate: string;
  endDate: string;
  rowLimit?: number;
  timeoutMs?: number;
};

export type GscFetchResult =
  | { ok: true; window: GscQueryWindow }
  | { ok: false; reason: string };

function decodePrivateKey(raw: string): string {
  // Vercel env vars commonly contain literal \n escape sequences instead
  // of real newlines. Both Google SDKs require real newlines in the PEM.
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

export async function fetchTopQueries(options: GscFetchOptions): Promise<GscFetchResult> {
  const state = getSearchConsoleConnectionState();
  if (!state.connected) {
    return { ok: false, reason: state.reason };
  }

  const env = process.env as GscEnv;
  const privateKey = decodePrivateKey(env.GSC_PRIVATE_KEY!.trim());
  const clientEmail = env.GSC_CLIENT_EMAIL!.trim();
  const siteUrl = env.GSC_SITE_URL!.trim();
  const rowLimit = options.rowLimit ?? DEFAULT_ROW_LIMIT;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  try {
    const jwt = new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: SCOPES,
    });

    const searchconsole = google.searchconsole({ version: "v1", auth: jwt });

    const response = await withTimeout(
      searchconsole.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate: options.startDate,
          endDate: options.endDate,
          dimensions: ["query", "page"],
          rowLimit,
        },
      }),
      timeoutMs,
      "Search Console fetch",
    );

    const rawRows = response.data.rows ?? [];
    const rows: GscQueryRow[] = rawRows
      .map((row) => {
        const keys = row.keys ?? [];
        return {
          query: typeof keys[0] === "string" ? keys[0] : "",
          page: typeof keys[1] === "string" ? keys[1] : "",
          clicks: typeof row.clicks === "number" ? row.clicks : 0,
          impressions: typeof row.impressions === "number" ? row.impressions : 0,
          ctr: typeof row.ctr === "number" ? row.ctr : 0,
          position: typeof row.position === "number" ? row.position : 0,
        };
      })
      .filter((row) => row.query.length > 0 && row.page.length > 0);

    return {
      ok: true,
      window: {
        startDate: options.startDate,
        endDate: options.endDate,
        rows,
      },
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Unknown GSC error";
    return { ok: false, reason };
  }
}
