-- Little Smiles ContentOps: notification preferences (Commit W)
-- Run in Supabase SQL editor (safe to re-run).
--
-- Single-row singleton pattern: the table holds exactly one preferences
-- record, addressed by id='default'. When multi-tenancy lands, this
-- table grows a tenant_id column and the singleton becomes one row per
-- tenant — the engine helpers are written to make that migration trivial.

create table if not exists public.contentops_notification_preferences (
  id text primary key default 'default',
  digest_enabled boolean not null default false,
  digest_recipient_email text null,
  skip_empty_digests boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Enforce the singleton: only the 'default' row may exist until
  -- multi-tenancy adds a tenant_id discriminator.
  constraint contentops_notification_preferences_singleton check (id = 'default')
);

-- Seed the singleton row on a fresh database. Idempotent.
insert into public.contentops_notification_preferences (id)
values ('default')
on conflict (id) do nothing;
