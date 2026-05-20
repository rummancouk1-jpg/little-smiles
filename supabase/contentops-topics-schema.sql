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

-- ---------------------------------------------------------------------------
-- Programmatic SEO expansion (Commit AB)
-- ---------------------------------------------------------------------------
-- format  — editorial template the operator (or AI) should write to.
-- cluster — high-level topical bucket the topic belongs to; mirrors the
--           clusters defined in lib/contentops/intelligence/clusters.ts.
-- seasonal_relevance — operator-set 0..100 score nudging the publishing
--           cadence when seasonality is non-evergreen. Nullable; the
--           seasonal-score helper computes a fallback from `seasonality`
--           + the current month when this is missing.
--
-- All three columns are nullable / defaulted so existing rows and any
-- code path that doesn't yet write them stays valid.

alter table public.contentops_topics
  add column if not exists format text null,
  add column if not exists cluster text null,
  add column if not exists seasonal_relevance integer null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'contentops_topics_format_check'
  ) then
    alter table public.contentops_topics
      add constraint contentops_topics_format_check
      check (
        format is null
        or format in (
          'guide',
          'comparison',
          'faq',
          'checklist',
          'seasonal',
          'beginner',
          'best_for',
          'problem_solution'
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'contentops_topics_cluster_check'
  ) then
    alter table public.contentops_topics
      add constraint contentops_topics_cluster_check
      check (
        cluster is null
        or cluster in ('Sleep', 'Feeding', 'Wardrobe', 'Outings', 'Gifting', 'Newborn Care')
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'contentops_topics_seasonal_relevance_check'
  ) then
    alter table public.contentops_topics
      add constraint contentops_topics_seasonal_relevance_check
      check (
        seasonal_relevance is null
        or (seasonal_relevance >= 0 and seasonal_relevance <= 100)
      );
  end if;
end $$;

create index if not exists idx_contentops_topics_format
  on public.contentops_topics(format)
  where format is not null;

create index if not exists idx_contentops_topics_cluster
  on public.contentops_topics(cluster)
  where cluster is not null;

-- Backfill format + cluster on the original seed rows. ON CONFLICT
-- preserves any operator edits to other columns. Idempotent.
insert into public.contentops_topics
  (title, intent, related_category, priority, competition, seasonality, trend, source,
   format, cluster, seasonal_relevance)
values
  ('How to choose a newborn swaddle for hot weather',
   'informational', 'Swaddle', 'high', 'medium', 'summer', 'rising', 'seed',
   'seasonal', 'Sleep', 88),
  ('Premium baby essentials checklist for new mothers in Pakistan',
   'commercial', 'Bodysuits', 'high', 'high', 'evergreen', 'steady', 'seed',
   'checklist', 'Newborn Care', 60),
  ('Helping your baby sleep through the night: a calm guide',
   'informational', 'Swaddle', 'medium', 'high', 'evergreen', 'steady', 'seed',
   'guide', 'Sleep', 55),
  ('Summer clothing essentials for babies under one year',
   'commercial', 'Bodysuits', 'medium', 'medium', 'summer', 'rising', 'seed',
   'seasonal', 'Wardrobe', 84),
  ('Setting up a feeding routine in the first three months',
   'informational', 'Feeding Cushion', 'high', 'medium', 'evergreen', 'steady', 'seed',
   'beginner', 'Feeding', 58),
  ('Choosing the right diaper bag for short outings',
   'commercial', 'Food Bag', 'medium', 'medium', 'evergreen', 'steady', 'seed',
   'best_for', 'Outings', 52),
  ('Premium baby gift basket ideas for Eid',
   'commercial', 'Bow Set', 'low', 'low', 'eid', 'rising', 'seed',
   'seasonal', 'Gifting', 70)
on conflict (title) do update set
  format             = coalesce(public.contentops_topics.format, excluded.format),
  cluster            = coalesce(public.contentops_topics.cluster, excluded.cluster),
  seasonal_relevance = coalesce(public.contentops_topics.seasonal_relevance, excluded.seasonal_relevance);

-- New seed batch — programmatic SEO topics spanning formats and
-- clusters. ON CONFLICT (title) DO NOTHING preserves any operator
-- edits and prevents duplicate inserts on re-run.
insert into public.contentops_topics
  (title, intent, related_category, priority, competition, seasonality, trend, source,
   content_angle, suggested_cta, confidence_score, format, cluster, seasonal_relevance)
values
  ('Best swaddle for summer in Pakistan',
   'commercial', 'Swaddle', 'high', 'medium', 'summer', 'rising', 'seed',
   'Practical seasonal pick guide with fabric and fit checks.',
   'Shop summer swaddles', 86, 'best_for', 'Sleep', 92),
  ('Muslin vs cotton swaddle: which is better for newborns',
   'informational', 'Swaddle', 'high', 'medium', 'evergreen', 'rising', 'seed',
   'Calm head-to-head comparison anchored to comfort and breathability.',
   'Shop muslin swaddles', 80, 'comparison', 'Sleep', 50),
  ('Newborn sleep checklist for first-time parents',
   'informational', 'Swaddle', 'high', 'medium', 'evergreen', 'steady', 'seed',
   'Stepwise checklist with comfort-led routine cues.',
   'Shop sleep essentials', 74, 'checklist', 'Sleep', 50),
  ('Diaper bag essentials for travel with a baby',
   'commercial', 'Food Bag', 'medium', 'medium', 'evergreen', 'steady', 'seed',
   'Travel-day checklist with what truly gets used.',
   'Shop travel essentials', 68, 'checklist', 'Outings', 50),
  ('Winter newborn clothing guide for Pakistan',
   'informational', 'Bodysuits', 'high', 'medium', 'winter', 'rising', 'seed',
   'Layer-by-layer winter guide grounded in local climate.',
   'Shop winter bodysuits', 80, 'seasonal', 'Wardrobe', 88),
  ('FAQ: bathing a newborn safely',
   'informational', 'Bodysuits', 'medium', 'low', 'evergreen', 'steady', 'seed',
   'Operator-friendly FAQ that answers the first questions calmly.',
   'Shop newborn essentials', 64, 'faq', 'Newborn Care', 50),
  ('Beginner guide to baby feeding cushions',
   'commercial', 'Feeding Cushion', 'medium', 'medium', 'evergreen', 'steady', 'seed',
   'First-time-parent walkthrough of when and how to use a cushion.',
   'Shop feeding cushions', 70, 'beginner', 'Feeding', 50),
  ('Best food bag for school lunches in Pakistan',
   'commercial', 'Food Container', 'medium', 'medium', 'evergreen', 'steady', 'seed',
   'Lunchbox-style buying guide with practical sizing notes.',
   'Shop food containers', 66, 'best_for', 'Feeding', 50),
  ('When your baby refuses the swaddle: gentle next steps',
   'informational', 'Swaddle', 'medium', 'medium', 'evergreen', 'steady', 'seed',
   'Problem/solution piece with calm alternatives.',
   'Shop sleep essentials', 62, 'problem_solution', 'Sleep', 50),
  ('Eid gifting guide: thoughtful baby gifts under PKR 5,000',
   'commercial', 'Bow Set', 'medium', 'low', 'eid', 'rising', 'seed',
   'Curated thoughtful-gift roundup with calm framing.',
   'Shop Eid gifts', 72, 'best_for', 'Gifting', 75),
  ('Comparison: feeding cushion vs nursing pillow',
   'informational', 'Feeding Cushion', 'medium', 'low', 'evergreen', 'steady', 'seed',
   'Side-by-side comparison anchored to comfort and posture.',
   'Shop feeding cushions', 66, 'comparison', 'Feeding', 50),
  ('Monsoon-ready outing kit for parents in Pakistan',
   'commercial', 'Food Bag', 'medium', 'medium', 'monsoon', 'rising', 'seed',
   'Seasonal kit guide with practical waterproofing notes.',
   'Shop outings essentials', 68, 'seasonal', 'Outings', 80)
on conflict (title) do nothing;
