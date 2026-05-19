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
    status in ('queued', 'drafted', 'published', 'archived', 'snoozed')
  ),
  draft_id uuid null references public.contentops_drafts(id) on delete set null,
  source text not null default 'manual' check (
    source in ('manual', 'seed')
  ),
  notes text null,
  -- Editorial intelligence layer (Commit V). Optional fields populated
  -- by seeds and future auto-discovery; operator input remains the
  -- title + a few defaults. The card UI surfaces these when present
  -- and stays clean when absent.
  content_angle text null,
  suggested_cta text null,
  confidence_score integer null,
  snoozed_until date null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Idempotent column adds for databases provisioned before Commit V.
alter table public.contentops_topics
  add column if not exists content_angle text null,
  add column if not exists suggested_cta text null,
  add column if not exists confidence_score integer null,
  add column if not exists snoozed_until date null;

-- Bound confidence_score to 0..100 if present.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'contentops_topics_confidence_score_check'
  ) then
    alter table public.contentops_topics
      add constraint contentops_topics_confidence_score_check
      check (confidence_score is null or (confidence_score >= 0 and confidence_score <= 100));
  end if;
end $$;

-- Expand status check to admit the new 'snoozed' value used by the
-- save-for-later flow. Replace by name (idempotent via drop-if-exists).
alter table public.contentops_topics
  drop constraint if exists contentops_topics_status_check;
alter table public.contentops_topics
  add constraint contentops_topics_status_check
  check (status in ('queued', 'drafted', 'published', 'archived', 'snoozed'));

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

-- Seeds carry the editorial intelligence layer. ON CONFLICT DO UPDATE
-- backfills the angle / cta / confidence fields on rows seeded before
-- Commit V, without overwriting any operator edits to other columns.
insert into public.contentops_topics
  (title, intent, related_category, priority, competition, seasonality, trend, source,
   content_angle, suggested_cta, confidence_score)
values
  ('How to choose a newborn swaddle for hot weather',
   'informational', 'Swaddle', 'high', 'medium', 'summer', 'rising', 'seed',
   'Practical seasonal buying guide with comfort-first framing.',
   'Shop breathable swaddles',
   84),
  ('Premium baby essentials checklist for new mothers in Pakistan',
   'commercial', 'Bodysuits', 'high', 'high', 'evergreen', 'steady', 'seed',
   'First-time-parent checklist with curated picks.',
   'Shop newborn essentials',
   78),
  ('Helping your baby sleep through the night: a calm guide',
   'informational', 'Swaddle', 'medium', 'high', 'evergreen', 'steady', 'seed',
   'Calm sleep guidance anchored to swaddle and routine.',
   'Shop sleep essentials',
   71),
  ('Summer clothing essentials for babies under one year',
   'commercial', 'Bodysuits', 'medium', 'medium', 'summer', 'rising', 'seed',
   'Seasonal capsule wardrobe — fabrics, fits, and what to skip.',
   'Shop summer bodysuits',
   76),
  ('Setting up a feeding routine in the first three months',
   'informational', 'Feeding Cushion', 'high', 'medium', 'evergreen', 'steady', 'seed',
   'Practical routine guide with comfort-supporting products.',
   'Shop feeding essentials',
   73),
  ('Choosing the right diaper bag for short outings',
   'commercial', 'Food Bag', 'medium', 'medium', 'evergreen', 'steady', 'seed',
   'Daily-use buying guide focused on what really gets used.',
   'Shop diaper bags',
   65),
  ('Premium baby gift basket ideas for Eid',
   'commercial', 'Bow Set', 'low', 'low', 'eid', 'rising', 'seed',
   'Gifting guide with curated premium picks.',
   'Shop gifting collection',
   68)
on conflict (title) do update set
  content_angle    = coalesce(public.contentops_topics.content_angle, excluded.content_angle),
  suggested_cta    = coalesce(public.contentops_topics.suggested_cta, excluded.suggested_cta),
  confidence_score = coalesce(public.contentops_topics.confidence_score, excluded.confidence_score);
