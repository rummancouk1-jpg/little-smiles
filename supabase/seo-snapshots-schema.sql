-- Little Smiles SEO snapshot schema
-- Run in Supabase SQL editor (safe to re-run)
--
-- One row per provider per snapshot_date. The unique index on snapshot_date
-- gives us natural upsert semantics: re-running the cron the same day
-- refreshes the row instead of creating duplicates.

create table if not exists public.seo_gsc_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null,
  window_start date not null,
  window_end date not null,
  rows jsonb not null,
  row_count int not null,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_seo_gsc_snapshot_date
  on public.seo_gsc_snapshots(snapshot_date);

create index if not exists idx_seo_gsc_snapshot_created
  on public.seo_gsc_snapshots(created_at desc);

create table if not exists public.seo_ga4_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null,
  window_start date not null,
  window_end date not null,
  rows jsonb not null,
  row_count int not null,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_seo_ga4_snapshot_date
  on public.seo_ga4_snapshots(snapshot_date);

create index if not exists idx_seo_ga4_snapshot_created
  on public.seo_ga4_snapshots(created_at desc);
