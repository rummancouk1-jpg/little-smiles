-- Little Smiles ContentOps AI drafts schema
-- Run in Supabase SQL editor (safe to re-run)

create table if not exists public.contentops_drafts (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  status text not null default 'pending_review' check (
    status in ('pending_review', 'approved', 'rejected', 'published', 'scheduled')
  ),
  content jsonb not null,
  rejection_note text null,
  publish_notes text null,
  approved_at timestamptz null,
  published_at timestamptz null,
  scheduled_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Idempotent column add for databases provisioned before publish_notes existed.
alter table public.contentops_drafts
  add column if not exists publish_notes text null;

-- Commit K: forward-compat for scheduled publishing. The column lands now
-- so Commit M can wire scheduling without a second migration. No rows use
-- this column until M ships.
alter table public.contentops_drafts
  add column if not exists scheduled_at timestamptz null;

-- Expand the status CHECK constraint to allow 'scheduled'. Postgres has no
-- "alter check" — replace by name. Idempotent via drop-if-exists.
alter table public.contentops_drafts
  drop constraint if exists contentops_drafts_status_check;
alter table public.contentops_drafts
  add constraint contentops_drafts_status_check
  check (status in ('pending_review', 'approved', 'rejected', 'published', 'scheduled'));

create index if not exists idx_contentops_drafts_status_created
  on public.contentops_drafts(status, created_at desc);

-- Replace the partial unique index so 'scheduled' joins the active-status
-- set. A draft that's been scheduled for future publish must still block
-- a duplicate active draft on the same slug.
drop index if exists public.idx_contentops_drafts_slug_active;
create unique index if not exists idx_contentops_drafts_slug_active
  on public.contentops_drafts(slug)
  where status in ('pending_review', 'approved', 'scheduled');
