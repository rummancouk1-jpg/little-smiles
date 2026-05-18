lib/
  content-ops/
    schema.ts              ── Zod: TopicCluster, TopicBrief, BlogPost, BlogRefresh
    prompts/
      brief.v1.ts
      draft.v1.ts
      critique.v1.ts
      metadata.v1.ts
    pipeline/
      orchestrator.ts      ── advances a draft through stages
      stages/
        discover.ts
        brief.ts
        draft.ts
        critique.ts
        metadata.ts
    ai/
      anthropic.ts         ── thin SDK wrapper with caching + cost logging
      embeddings.ts
    images/
      hero-curator.ts      ── Unsplash/Pexels search + filter
      pinterest-card.tsx   ── Satori/@vercel/og templates
      sharp-pipeline.ts
    linking/
      suggest.ts           ── pgvector query + LLM constraining
      reverse-links.ts
    publishing/
      scheduler.ts
      revalidate.ts
    refresh/
      stale-detector.ts
      refresh-brief.ts
    voice/
      brand-voice.md       ── single source for tone
      style-anchors.ts     ── 2-3 best human-written posts referenced by drafts
  blog.ts                  ── stays, but reads from Supabase (with fallback to existing data during migration)
  seo/
    metadata.ts            ── consolidates staticPageMetadata + post metadata
    json-ld-registry.ts

app/
  admin/
    content/
      queue/page.tsx        ── topic candidates from discovery
      briefs/page.tsx       ── briefs awaiting approval
      drafts/page.tsx       ── drafts awaiting editorial sign-off
      drafts/[id]/page.tsx  ── diff viewer + approve/reject
      schedule/page.tsx     ── upcoming publish calendar
      refresh/page.tsx      ── posts flagged for refresh
  api/
    cron/
      discover-topics/route.ts
      publish-due-posts/route.ts
      detect-stale/route.ts
    content-ops/
      pipeline/[stage]/route.ts  ── admin-triggered stage advance

supabase/migrations/
  20260601_blog_drafts.sql
  20260601_blog_embeddings.sql
  20260601_content_events.sql