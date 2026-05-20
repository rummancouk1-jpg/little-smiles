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
  manually_edited boolean not null default false,
  last_edited_at timestamptz null,
  ai_generated_content jsonb null,
  previous_content jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Idempotent column add for databases provisioned before publish_notes existed.
alter table public.contentops_drafts
  add column if not exists publish_notes text null;

-- Edit-in-place revision tracking (Commit X). Lightweight: a single
-- boolean flag + last-edited timestamp. Full version history is out of
-- scope; these two fields are enough for the operator-facing "AI
-- draft" vs "Edited" distinction.
alter table public.contentops_drafts
  add column if not exists manually_edited boolean not null default false,
  add column if not exists last_edited_at timestamptz null;

-- Lightweight revision safety (Commit Z). Two JSONB snapshots:
--   ai_generated_content — captured once at insert, never overwritten.
--                          Lets the operator restore to the original AI
--                          output regardless of how many edits have
--                          happened since.
--   previous_content     — captured before each edit save. Single-step
--                          undo. Subsequent restores cycle previous ↔
--                          current, so the undo itself is undoable.
-- Both are nullable; the UI hides the corresponding restore action when
-- a snapshot isn't present (e.g. drafts created before Commit Z).
alter table public.contentops_drafts
  add column if not exists ai_generated_content jsonb null,
  add column if not exists previous_content jsonb null;

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
