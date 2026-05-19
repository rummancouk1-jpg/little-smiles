-- Little Smiles ContentOps AI: keyword/topic queue (Commit R)
-- Run in Supabase SQL editor (safe to re-run).
--
-- This is the editorial planning layer. Each row is a topic the operator
-- wants to (eventually) publish about. The fields are intentionally
-- generous so future intelligence layers (auto-discovery, SEO scoring,
-- trend tracking) can populate them without further migration.

create table if not exists public.contentops_topics (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  intent text not null default 'informational' check (
    intent in ('informational', 'commercial', 'transactional')
  ),
  related_category text null,
  priority text not null default 'medium' check (
    priority in ('high', 'medium', 'low')
  ),
  competition text not null default 'medium' check (
    competition in ('low', 'medium', 'high')
  ),
  seasonality text not null default 'evergreen' check (
    seasonality in ('evergreen', 'summer', 'winter', 'monsoon', 'eid')
  ),
  trend text not null default 'steady' check (
    trend in ('rising', 'steady', 'declining')
  ),
  suggested_window_start date null,
  suggested_window_end date null,
  status text not null default 'queued' check (
    status in ('queued', 'drafted', 'published', 'archived')
  ),
  draft_id uuid null references public.contentops_drafts(id) on delete set null,
  source text not null default 'manual' check (
    source in ('manual', 'seed')
  ),
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Unique title prevents duplicate queueing of the same topic (case-sensitive
-- on purpose; "Best Swaddles" vs "best swaddles" stay distinct so operator
-- choice is respected).
create unique index if not exists idx_contentops_topics_title
  on public.contentops_topics(title);

create index if not exists idx_contentops_topics_status_priority
  on public.contentops_topics(status, priority);

create index if not exists idx_contentops_topics_seasonality
  on public.contentops_topics(seasonality);

create index if not exists idx_contentops_topics_draft_id
  on public.contentops_topics(draft_id)
  where draft_id is not null;

-- ---------------------------------------------------------------------------
-- Seed topics
-- ---------------------------------------------------------------------------
-- Idempotent: ON CONFLICT (title) DO NOTHING preserves any operator changes
-- and avoids duplicate inserts on re-run. Source = 'seed' lets future
-- queries distinguish curated starter content from operator entries.

insert into public.contentops_topics (title, intent, related_category, priority, competition, seasonality, trend, source) values
  ('How to choose a newborn swaddle for hot weather', 'informational', 'Swaddle', 'high', 'medium', 'summer', 'rising', 'seed'),
  ('Premium baby essentials checklist for new mothers in Pakistan', 'commercial', 'Bodysuits', 'high', 'high', 'evergreen', 'steady', 'seed'),
  ('Helping your baby sleep through the night: a calm guide', 'informational', 'Swaddle', 'medium', 'high', 'evergreen', 'steady', 'seed'),
  ('Summer clothing essentials for babies under one year', 'commercial', 'Bodysuits', 'medium', 'medium', 'summer', 'rising', 'seed'),
  ('Setting up a feeding routine in the first three months', 'informational', 'Feeding Cushion', 'high', 'medium', 'evergreen', 'steady', 'seed'),
  ('Choosing the right diaper bag for short outings', 'commercial', 'Food Bag', 'medium', 'medium', 'evergreen', 'steady', 'seed'),
  ('Premium baby gift basket ideas for Eid', 'commercial', 'Bow Set', 'low', 'low', 'eid', 'rising', 'seed')
on conflict (title) do nothing;
