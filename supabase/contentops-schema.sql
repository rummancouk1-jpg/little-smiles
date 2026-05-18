-- Little Smiles ContentOps AI drafts schema
-- Run in Supabase SQL editor (safe to re-run)

create table if not exists public.contentops_drafts (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  status text not null default 'pending_review' check (
    status in ('pending_review', 'approved', 'rejected', 'published')
  ),
  content jsonb not null,
  rejection_note text null,
  publish_notes text null,
  approved_at timestamptz null,
  published_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Idempotent column add for databases provisioned before publish_notes existed.
alter table public.contentops_drafts
  add column if not exists publish_notes text null;

create index if not exists idx_contentops_drafts_status_created
  on public.contentops_drafts(status, created_at desc);

create unique index if not exists idx_contentops_drafts_slug_active
  on public.contentops_drafts(slug)
  where status in ('pending_review', 'approved');
