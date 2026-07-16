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

-- Additive: structured rejection reason (which checks failed at reject time).
-- Recorded alongside the free-text rejection_note; feeds the drafting
-- "avoid these failure modes" cautions. Nullable + backward-compatible; the
-- reject path degrades gracefully (PGRST204) when this column is not yet applied.
alter table public.contentops_drafts
  add column if not exists rejection_reason jsonb null;

-- Additive: the AI-generated ORIGINAL content, captured at insert and never
-- edited afterward. The enforce-edit guard (Phase 3) compares `content` against
-- this to block publishing a draft the reviewer never touched. Nullable +
-- backward-compatible; insert degrades gracefully (PGRST204) when not yet
-- applied, and the guard allows drafts whose original is unknown (null).
alter table public.contentops_drafts
  add column if not exists original_content jsonb null;

create index if not exists idx_contentops_drafts_status_created
  on public.contentops_drafts(status, created_at desc);

create unique index if not exists idx_contentops_drafts_slug_active
  on public.contentops_drafts(slug)
  where status in ('pending_review', 'approved');
