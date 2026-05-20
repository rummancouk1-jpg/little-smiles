// GA4 adapter — minimal, dependency-free. Reports against the GA4 Data
// API using the bearer token an external service-account exchange would
// provide. We do NOT bake the Google service-account JWT exchange into
// this module to avoid a new dependency on `google-auth-library`; the
// operator wires in a real token by setting GA4_BEARER_TOKEN in env, or
// drops a real client in later behind the same interface.
//
// Until both env vars are present, isConfigured() returns false and
// every method returns []. The operator dashboard renders a calm
// "configure GA4 to see this" hint in that case.

import type { AnalyticsAdapter, TopPagePoint } from "@/lib/contentops/analytics/types";

const GA4_API = "https://analyticsdata.googleapis.com/v1beta";

function getEnv(): { propertyId: string | null; token: string | null } {
  return {
    propertyId: process.env.GA4_PROPERTY_ID?.trim() || null,
    token: process.env.GA4_BEARER_TOKEN?.trim() || null,
  };
}

export const ga4Adapter: AnalyticsAdapter = {
  id: "ga4",
  isConfigured() {
    const { propertyId, token } = getEnv();
    return Boolean(propertyId) && Boolean(token);
  },
  async topPages({ days, limit }): Promise<TopPagePoint[]> {
    const { propertyId, token } = getEnv();
    if (!propertyId || !token) return [];

    const endpoint = `${GA4_API}/properties/${encodeURIComponent(propertyId)}:runReport`;
    const body = {
      dateRanges: [{ startDate: `${days}daysAgo`, endDate: "today" }],
      dimensions: [{ name: "pagePath" }],
      metrics: [{ name: "screenPageViews" }],
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit: String(Math.min(Math.max(limit, 1), 250)),
    };

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
        // Server route — disable Next's cache.
        cache: "no-store",
      });
      if (!response.ok) return [];
      const json = (await response.json()) as {
        rows?: Array<{ dimensionValues?: Array<{ value?: string }>; metricValues?: Array<{ value?: string }> }>;
      };
      const rows = json.rows ?? [];
      return rows
        .map((row) => {
          const path = row.dimensionValues?.[0]?.value ?? "";
          const raw = row.metricValues?.[0]?.value ?? "0";
          const views = Number.parseInt(raw, 10);
          return { path, views: Number.isFinite(views) ? views : 0, source: "ga4" as const };
        })
        .filter((p) => p.path.startsWith("/"));
    } catch {
      // Network/token failure → calm empty result. Caller renders the
      // "not configured" hint without surfacing a 500 to the operator.
      return [];
    }
  },
};
