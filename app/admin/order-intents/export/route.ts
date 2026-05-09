import { NextResponse } from "next/server";

import { getAdminSessionFromRequest, isAuthorizedAdminRequest } from "@/lib/admin-auth";
import { logAdminAudit } from "@/lib/admin-audit";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

type RangeFilter = "7d" | "30d" | "all";
type ExportMode = "grouped" | "raw" | "daily";

type OrderIntentRow = {
  product_slug: string | null;
  product_name: string | null;
  category: string | null;
  source_page: string;
  event_timestamp: string;
};

type GroupedIntentRow = {
  product_slug: string;
  product_name: string;
  category: string;
  source_page: string;
  total_clicks: number;
  latest_click_time: string;
};

type DailyIntentRow = {
  date: string;
  product_slug: string;
  product_name: string;
  category: string;
  total_clicks: number;
};

function resolveRange(input: string | null): RangeFilter {
  if (input === "7d" || input === "30d" || input === "all") return input;
  return "7d";
}

function resolveMode(input: string | null): ExportMode {
  if (input === "grouped" || input === "raw" || input === "daily") return input;
  return "grouped";
}

function cutoffIso(range: RangeFilter): string | null {
  if (range === "all") return null;
  const days = range === "7d" ? 7 : 30;
  const dt = new Date();
  dt.setDate(dt.getDate() - days);
  return dt.toISOString();
}

function groupIntents(rows: OrderIntentRow[]): GroupedIntentRow[] {
  const map = new Map<string, GroupedIntentRow>();

  for (const row of rows) {
    const productSlug = row.product_slug ?? "unknown";
    const productName = row.product_name ?? "Unknown product";
    const category = row.category ?? "Unknown";
    const sourcePage = row.source_page || "unknown";
    const key = `${productSlug}::${productName}::${category}::${sourcePage}`;
    const existing = map.get(key);

    if (!existing) {
      map.set(key, {
        product_slug: productSlug,
        product_name: productName,
        category,
        source_page: sourcePage,
        total_clicks: 1,
        latest_click_time: row.event_timestamp,
      });
      continue;
    }

    existing.total_clicks += 1;
    if (new Date(row.event_timestamp).getTime() > new Date(existing.latest_click_time).getTime()) {
      existing.latest_click_time = row.event_timestamp;
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (b.total_clicks !== a.total_clicks) return b.total_clicks - a.total_clicks;
    return new Date(b.latest_click_time).getTime() - new Date(a.latest_click_time).getTime();
  });
}

function toCsv(rows: GroupedIntentRow[]): string {
  const header = [
    "product_slug",
    "product_name",
    "category",
    "source_page",
    "total_clicks",
    "latest_click_time",
  ];
  const escape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
  const body = rows.map((row) =>
    [
      escape(row.product_slug),
      escape(row.product_name),
      escape(row.category),
      escape(row.source_page),
      escape(row.total_clicks),
      escape(row.latest_click_time),
    ].join(","),
  );
  return [header.join(","), ...body].join("\n");
}

function toRawCsv(rows: OrderIntentRow[]): string {
  const header = [
    "product_slug",
    "product_name",
    "category",
    "source_page",
    "event_timestamp",
  ];
  const escape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
  const body = rows.map((row) =>
    [
      escape(row.product_slug ?? ""),
      escape(row.product_name ?? ""),
      escape(row.category ?? ""),
      escape(row.source_page),
      escape(row.event_timestamp),
    ].join(","),
  );
  return [header.join(","), ...body].join("\n");
}

function summarizeDaily(rows: OrderIntentRow[]): DailyIntentRow[] {
  const map = new Map<string, DailyIntentRow>();

  for (const row of rows) {
    const date = row.event_timestamp.slice(0, 10);
    const productSlug = row.product_slug ?? "unknown";
    const productName = row.product_name ?? "Unknown product";
    const category = row.category ?? "Unknown";
    const key = `${date}::${productSlug}::${productName}::${category}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        date,
        product_slug: productSlug,
        product_name: productName,
        category,
        total_clicks: 1,
      });
      continue;
    }
    existing.total_clicks += 1;
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    if (b.total_clicks !== a.total_clicks) return b.total_clicks - a.total_clicks;
    return a.product_name.localeCompare(b.product_name);
  });
}

function toDailyCsv(rows: DailyIntentRow[]): string {
  const header = ["date", "product_slug", "product_name", "category", "total_clicks"];
  const escape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
  const body = rows.map((row) =>
    [
      escape(row.date),
      escape(row.product_slug),
      escape(row.product_name),
      escape(row.category),
      escape(row.total_clicks),
    ].join(","),
  );
  return [header.join(","), ...body].join("\n");
}

export const dynamic = "force-dynamic";

function actorFileStamp(actorLabel: string | undefined): string {
  if (!actorLabel) return "admin";
  const slug = actorLabel
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  return slug || "admin";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const range = resolveRange(url.searchParams.get("range"));
  const mode = resolveMode(url.searchParams.get("mode"));

  if (!isAuthorizedAdminRequest(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 503 });
  }

  const query = supabase
    .from("order_intents")
    .select("product_slug, product_name, category, source_page, event_timestamp")
    .order("event_timestamp", { ascending: false })
    .limit(5000);

  const cutoff = cutoffIso(range);
  if (cutoff) query.gte("event_timestamp", cutoff);

  const { data, error } = await query;
  if (error) {
    await logAdminAudit(request, {
      action: "order_intents_export_failed",
      targetType: "order_intents",
      metadata: { mode, range },
    });
    return NextResponse.json({ ok: false, error: "Could not export data" }, { status: 500 });
  }

  const rows = (data ?? []) as OrderIntentRow[];
  const exportCount =
    mode === "raw" ? rows.length : mode === "daily" ? summarizeDaily(rows).length : groupIntents(rows).length;
  const csv =
    mode === "raw"
      ? toRawCsv(rows)
      : mode === "daily"
        ? toDailyCsv(summarizeDaily(rows))
        : toCsv(groupIntents(rows));
  const timestamp = new Date().toISOString().slice(0, 10);
  const actorLabel = getAdminSessionFromRequest(request)?.actorLabel;
  const actorStamp = actorFileStamp(actorLabel);

  await logAdminAudit(request, {
    action: "order_intents_exported",
    targetType: "order_intents",
    metadata: { mode, range, rowCount: exportCount },
  });

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=\"order-intents-${mode}-${range}-${timestamp}-${actorStamp}.csv\"`,
      "Cache-Control": "no-store",
    },
  });
}
