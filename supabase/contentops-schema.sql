-- Little Smiles ContentOps AI drafts schema
-- Run in Supabase SQL editor (safe to re-run)

create table if not exists public.contentops_drafts (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  status text not null default 'pending_review' check (
    status in ('pending_review', 'approved', 'rejected', 'published')
  ),
  content jsonb not null,
  hero_image_path text null,
  rejection_note text null,
  approved_at timestamptz null,
  published_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Additive migration for tables that pre-date the hero_image_path column.
-- Safe to re-run.
alter table public.contentops_drafts
  add column if not exists hero_image_path text null;

-- Additive: Opus critique-pass output (flagged issues for the human reviewer).
-- Nullable + backward-compatible; existing rows read null and the code
-- degrades gracefully (PGRST204) when this column hasn't been applied yet.
alter table public.contentops_drafts
  add column if not exists critique jsonb null;

create index if not exists idx_contentops_drafts_status_created
  on public.contentops_drafts(status, created_at desc);

create unique index if not exists idx_contentops_drafts_slug_active
  on public.contentops_drafts(slug)
  where status in ('pending_review', 'approved');
