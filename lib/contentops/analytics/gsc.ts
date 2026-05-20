// Google Search Console adapter — same dependency-free shape as the
// GA4 adapter. Operator drops in a bearer token via GSC_BEARER_TOKEN +
// GSC_SITE_URL; until then every method returns [].
//
// We deliberately ship the interface ahead of a real auth flow so the
// dashboard can render its "not configured" hints without code changes
// when credentials are wired in later. A future commit can swap the
// bearer-token assumption for a JWT exchange behind this same surface.

import type {
  DecliningPage,
  IndexCoveragePoint,
  LowCtrOpportunity,
  SearchConsoleAdapter,
  TopPagePoint,
  TopQueryPoint,
} from "@/lib/contentops/analytics/types";

const GSC_API = "https://searchconsole.googleapis.com/webmasters/v3";

function getEnv(): { siteUrl: string | null; token: string | null } {
  return {
    siteUrl: process.env.GSC_SITE_URL?.trim() || null,
    token: process.env.GSC_BEARER_TOKEN?.trim() || null,
  };
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

async function querySearchAnalytics(
  body: Record<string, unknown>,
): Promise<unknown[] | null> {
  const { siteUrl, token } = getEnv();
  if (!siteUrl || !token) return null;
  const endpoint = `${GSC_API}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const json = (await response.json()) as { rows?: unknown[] };
    return json.rows ?? [];
  } catch {
    return null;
  }
}

export const gscAdapter: SearchConsoleAdapter = {
  id: "gsc",
  isConfigured() {
    const { siteUrl, token } = getEnv();
    return Boolean(siteUrl) && Boolean(token);
  },
  async topQueries({ days, limit }): Promise<TopQueryPoint[]> {
    const rows = await querySearchAnalytics({
      startDate: daysAgo(days),
      endDate: daysAgo(0),
      dimensions: ["query"],
      rowLimit: Math.min(Math.max(limit, 1), 250),
    });
    if (!rows) return [];
    return rows
      .map((row) => {
        const r = row as {
          keys?: string[];
          clicks?: number;
          impressions?: number;
          ctr?: number;
          position?: number;
        };
        return {
          query: r.keys?.[0] ?? "",
          clicks: typeof r.clicks === "number" ? r.clicks : 0,
          impressions: typeof r.impressions === "number" ? r.impressions : 0,
          ctr: typeof r.ctr === "number" ? r.ctr : 0,
          position: typeof r.position === "number" ? r.position : 0,
        };
      })
      .filter((p) => p.query.length > 0);
  },
  async topPages({ days, limit }): Promise<TopPagePoint[]> {
    const rows = await querySearchAnalytics({
      startDate: daysAgo(days),
      endDate: daysAgo(0),
      dimensions: ["page"],
      rowLimit: Math.min(Math.max(limit, 1), 250),
    });
    if (!rows) return [];
    return rows
      .map((row) => {
        const r = row as { keys?: string[]; clicks?: number };
        const url = r.keys?.[0] ?? "";
        let path = url;
        try {
          path = new URL(url).pathname;
        } catch {
          // url isn't a full URL — leave as-is.
        }
        return {
          path,
          views: typeof r.clicks === "number" ? r.clicks : 0,
          source: "gsc" as const,
        };
      })
      .filter((p) => p.path.startsWith("/"));
  },
  async indexCoverage(): Promise<IndexCoveragePoint[]> {
    // GSC's URL Inspection / Sitemap-status APIs are richer but the
    // operator dashboard only needs the headline trend. We return [] in
    // the dependency-free shape and let a richer client land later.
    return [];
  },

  // -------------------------------------------------------------------
  // Low-CTR opportunities — the single highest-leverage organic-growth
  // signal GSC produces. Surfaces (page, query) pairs that earn lots of
  // impressions but few clicks, suggesting the title/meta deserves a
  // rewrite.
  // -------------------------------------------------------------------
  async lowCtrOpportunities({
    days,
    limit,
    minImpressions,
    maxCtr,
  }): Promise<LowCtrOpportunity[]> {
    const rows = await querySearchAnalytics({
      startDate: daysAgo(days),
      endDate: daysAgo(0),
      dimensions: ["page", "query"],
      rowLimit: Math.min(Math.max(limit * 4, 50), 1000),
    });
    if (!rows) return [];
    return rows
      .map((row) => {
        const r = row as {
          keys?: string[];
          clicks?: number;
          impressions?: number;
          ctr?: number;
          position?: number;
        };
        let path = r.keys?.[0] ?? "";
        try {
          path = new URL(path).pathname;
        } catch {
          /* leave as-is */
        }
        return {
          path,
          query: r.keys?.[1] ?? "",
          impressions: typeof r.impressions === "number" ? r.impressions : 0,
          clicks: typeof r.clicks === "number" ? r.clicks : 0,
          ctr: typeof r.ctr === "number" ? r.ctr : 0,
          position: typeof r.position === "number" ? r.position : 0,
        };
      })
      .filter(
        (op) =>
          op.path.startsWith("/") &&
          op.impressions >= minImpressions &&
          op.ctr <= maxCtr,
      )
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, limit);
  },

  // -------------------------------------------------------------------
  // Pages losing traffic — two-window comparison. The most actionable
  // content-decay signal: pages that used to earn clicks and stopped.
  // -------------------------------------------------------------------
  async decliningPages({
    limit,
    minPriorClicks,
    minDropPercent,
  }): Promise<DecliningPage[]> {
    // Two 28-day windows: 0–28 days ago vs 28–56 days ago.
    const [recent, prior] = await Promise.all([
      querySearchAnalytics({
        startDate: daysAgo(28),
        endDate: daysAgo(0),
        dimensions: ["page"],
        rowLimit: 1000,
      }),
      querySearchAnalytics({
        startDate: daysAgo(56),
        endDate: daysAgo(28),
        dimensions: ["page"],
        rowLimit: 1000,
      }),
    ]);
    if (!recent || !prior) return [];

    const norm = (row: unknown) => {
      const r = row as { keys?: string[]; clicks?: number };
      let path = r.keys?.[0] ?? "";
      try {
        path = new URL(path).pathname;
      } catch {
        /* leave as-is */
      }
      return { path, clicks: typeof r.clicks === "number" ? r.clicks : 0 };
    };
    const recentMap = new Map(recent.map(norm).map((p) => [p.path, p.clicks]));
    const priorMap = new Map(prior.map(norm).map((p) => [p.path, p.clicks]));

    const out: DecliningPage[] = [];
    for (const [path, priorClicks] of priorMap) {
      if (!path.startsWith("/")) continue;
      if (priorClicks < minPriorClicks) continue;
      const recentClicks = recentMap.get(path) ?? 0;
      const change = ((recentClicks - priorClicks) / priorClicks) * 100;
      if (change > -minDropPercent) continue;
      out.push({
        path,
        recentClicks,
        priorClicks,
        changePercent: Math.round(change),
      });
    }
    return out.sort((a, b) => a.changePercent - b.changePercent).slice(0, limit);
  },
};
