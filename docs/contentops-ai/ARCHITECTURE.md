# ContentOps AI — Architecture

Locked decisions for the AI-assisted content operations subsystem. Verify against current code before relying on any specific identifier or path — decisions about *intent* outlive decisions about *naming*.

## Purpose

Automate the labor of producing SEO blog content for Little Smiles while keeping editorial judgment human. The reviewer (Rumman's wife) approves every published draft. The system optimizes for her bandwidth, not throughput.

## Why these decisions, in one line

Premium boutique brand, family business, single builder, limited hours. Every choice prioritizes reviewer ease, brand integrity, and stack minimalism over feature surface.

## Locked decisions

### Editorial workflow

- **Sole default reviewer:** Rumman's wife. She is the approve gate.
- **Cornerstone cosign toggle:** per-draft `needs_cosign` flag routes strategic posts to Rumman after her approval. Off by default.
- **UX budget:** ≤3 taps from "draft ready" to "scheduled" for a clean post.

### Notifications

- **Channels:** WhatsApp **and** email digest, both fired daily. Redundancy is deliberate — two kids, one missed channel is one missed publishing day.
- **Default time:** 20:30 PKT for the first month, then tune.
- **Empty-queue rule:** if 0 drafts pending, no notification fires. Prevents fatigue.

### Throughput

- **Cap:** 3 posts/week. Expand only after the flow feels effortless to her.
- **Pipeline throttle:** AI generation pauses when the queue has ≥4 pending drafts. Protects reviewer bandwidth from a backlog.

### Images

- **Hero:** human-curated stock (Unsplash / Pexels) processed through a Sharp pipeline. No generative AI for hero on a premium boutique.
- **Pinterest / social:** templated via Satori or `@vercel/og`.
- **Inline illustrations:** AI only when explicitly needed; never auto-publish.

### Stack

| Concern | Choice | Rejected alternatives |
|---|---|---|
| Content storage | Supabase (already in-stack) | Sanity, Notion, MDX files, Contentful |
| Content shape | Structured JSON validated by Zod, mirroring today's `BlogPost` in `lib/blog.ts` | Free-form markdown |
| LLM calls | Anthropic SDK direct: Sonnet 4.6 drafting, Opus 4.7 critique, Haiku 4.5 metadata | LangChain, multi-provider abstraction |
| Embeddings | pgvector in Supabase | Pinecone, Weaviate |
| Scheduling | Vercel Cron + DB status enum | Inngest, Trigger.dev — until actually needed |
| Admin UI | Extend existing `app/admin/` routes | Separate admin app |

## System components (intent only — no code yet)

- **Draft pipeline:** topic → outline (Sonnet) → draft (Sonnet) → critique (Opus) → metadata (Haiku) → review queue.
- **Review surface:** new admin routes under `app/admin/` (path TBD). Approve / cosign / schedule from a single screen.
- **Image orchestration:** stock selection → Sharp processing → social template render → asset records.
- **Scheduler:** cron sweeps drafts whose `scheduled_at` is due and publishes by flipping status.
- **Digest:** cron computes pending count, sends WhatsApp + email if >0.

Component naming, table shapes, and route paths will be specified at implementation time. This section captures *intent* only.

## Non-goals (explicit)

- No autonomous publish. Every public post crosses a human approve gate.
- No generative AI hero images.
- No multi-author / multi-tenant content surface.
- No scheduling system more sophisticated than `status` + `scheduled_at` until throughput demands it.
- No LangChain, no orchestration framework, no agentic loops.
- No productization for outside clients until Phase 1 has shipped and proven itself.

## Changing a decision

When a locked decision is reconsidered:

1. Append the change to [`ROADMAP.md`](ROADMAP.md) § Decisions log with date, what changed, and why.
2. Update this file in the **same commit**. Mark the previous wording superseded inline rather than deleting it, until the new approach has shipped.
3. If the change invalidates code that already exists, raise it before writing the diff — don't quietly drift.
