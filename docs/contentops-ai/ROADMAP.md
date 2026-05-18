# ContentOps AI — Roadmap

What's being built, in what order, with the decisions made along the way. This is the working operational document — update it in the same commit as any meaningful change.

## Current state

**Pre-implementation.** Documentation foundation in place. Architecture locked (see [ARCHITECTURE.md](ARCHITECTURE.md)). No code shipped. Phase 1 scope being defined.

## Operating constraints

- ≤2 weeks per phase. If a phase runs >2× estimate, stop and reassess — the plan is wrong, not the effort.
- Each phase must ship visible value to Rumman or his wife. No invisible infrastructure phases.
- Family business, single builder, limited hours. Scope respects that.

## Phases

### Phase 0 — Operational foundation

**Status:** in progress
**Outcome:** repo docs in place; locked decisions written down; cross-references wired.

- [x] Decide doc structure (3 files in `docs/contentops-ai/`)
- [x] Seed `ARCHITECTURE.md` from verbal commitments
- [x] Seed `ROADMAP.md` (this file)
- [x] Cross-reference from root `AI_CONTEXT.md`
- [x] Phase 1 scope locked

### Phase 1 — Reviewer-first slice

**Status:** locked, ready to implement
**Operating budget:** ≤2 weeks. If past 4 weeks, stop and reassess.
**Outcome:** wife receives a daily email digest, opens one admin page, approves drafts in three taps. Rumman pastes the generated diff into `lib/blog.ts` for the manual deploy gate.

**In scope (5 components):**

1. **Zod schema** mirroring `BlogPost` in `lib/blog.ts` — shared by existing blog code and the new draft pipeline. Single source of truth for content shape.
2. **Supabase `contentops_drafts` table** with `status` enum: `pending_review` | `approved` | `rejected` | `published`. Minimum columns aligned to `BlogPost`.
3. **CLI draft script** — `npm run contentops:draft -- "<topic>"`, calls **Sonnet only**, writes one row at `status=pending_review`. Local execution only.
4. **Admin page** at `app/admin/contentops/` — list pending, read, approve / reject. Approve generates a paste-ready `lib/blog.ts` diff on screen.
5. **Daily cron** at 20:30 PKT (`30 15 * * *` UTC) — counts pending drafts, sends **email digest only** for Phase 1. Empty-queue rule honored.

**Required dependency additions:**

- `@anthropic-ai/sdk` (not currently in `package.json`)
- `ANTHROPIC_API_KEY` env var (add to `RUNBOOK.md`, used by CLI script only — not exposed to browser)

**Out of scope — deferred:**

| Item | Phase |
|---|---|
| WhatsApp digest channel | 1.5 (once Twilio prod creds are verified) |
| Opus critique pass | 2 |
| Haiku metadata pass | 2 |
| Cosign toggle (`needs_cosign`) | 2 |
| Image orchestration (Sharp, Satori, social) | 2 |
| Auto-publish from Supabase to `/blog/[slug]` | 2 |
| Per-draft `scheduled_at` | 2 |
| Generation throttle at ≥4 pending | 2 |
| pgvector embeddings, topic clustering, internal-link suggestions | 3+ |

**Implementation order:**

1. **Zod schema** → `lib/contentops/blog-schema.ts`. Pure types. Refactor `lib/blog.ts` to import and validate existing posts at import time. Zero infra, smallest reviewable diff.
2. **Supabase migration** → `supabase/contentops-schema.sql` (`contentops_drafts` table + indexes). Add types to `lib/supabase-admin.ts`. Document in `RUNBOOK.md` migration order.
3. **Anthropic SDK install + CLI draft script** → `scripts/contentops-draft.ts`. Local-only. Sonnet 4.6, brand-voice in-context example from one existing post, output validated against the Zod schema before insert.
4. **Admin read surface** → `app/admin/contentops/page.tsx` (list + detail view). Read-only first. Verify drafts render correctly before adding mutations.
5. **Approve / reject + diff generator** → `app/api/admin/contentops/[id]/approve` + `/reject` routes. Pure-function diff generator returns a TS object literal matching `lib/blog.ts` formatting.
6. **Cron digest** → `app/api/cron/contentops-digest/route.ts`, schedule in `vercel.json`, Resend email template. Empty-queue guard.

Each step ships independently. Stop at any step if the next adds friction the previous one didn't earn.

### Phase 1.5 — WhatsApp digest channel

**Trigger:** Twilio production creds verified + test message delivered to reviewer's number.
**Scope:** add WhatsApp send alongside email in the existing digest cron. No other changes.

### Later phases

Not enumerated. Adding speculative phases here would be exactly the over-planning failure mode we're avoiding. Phase N+1 gets defined when Phase N ships.

## Decisions log

Append entries chronologically. Never delete — supersede.

| Date | Decision | Why | Status |
|---|---|---|---|
| 2026-05-18 | Adopt 3-file doc structure (README / ARCHITECTURE / ROADMAP) over the originally proposed 10-file numbered hierarchy | Ten pre-implementation docs is the overengineering trap; one doc per concern is enough until a concern is big enough to fail a scan | active |
| 2026-05-18 | Seed locked architecture from verbal commitments captured in prior session | Convert chat memory into repo source-of-truth so future sessions don't depend on long context windows | active |
| 2026-05-18 | Defer productization notes entirely (was `09_PRODUCTIZATION_NOTES.md` in original plan) | Wrong artifact at the wrong time — that's a future business doc, not a repo doc; Phase 1 hasn't shipped | active |
| 2026-05-18 | Phase 1 locked as 5-component reviewer-first slice | Smallest slice that materially reduces reviewer friction; everything else either invisible to her or risk-adding | active |
| 2026-05-18 | Approve generates paste-able `lib/blog.ts` diff; manual commit/deploy gate preserved | Git stays the live source of truth; zero blog-rendering changes; she owns editorial gate, Rumman owns deploy gate | active |
| 2026-05-18 | Phase 1 ships email-first; WhatsApp deferred to Phase 1.5 if Twilio prod creds need setup | One reliable channel beats blocking the slice on a second one; redundancy is a Phase 1.5 concern, not a Phase 1 one | active |
| 2026-05-18 | `@anthropic-ai/sdk` added as required Phase 1 dependency (not currently in `package.json`) | Locked architecture calls for direct SDK calls; flagged because original Phase 1 enumeration didn't list it | active |
| 2026-05-18 | Replace previously-committed 10-file Phase 0 (commit `d3d228d`) with the 3-file structure | Two architectures had coexisted across branches; the 3-file plan is the collaboratively designed canonical structure. Original 407-line content remains recoverable from commit `d3d228d` via `git show` if any section is worth porting later | active |

## Supersedes

- [`docs/blog-workflow.md`](../blog-workflow.md) — the manual blog publishing guide will be obsoleted when Phase 1 ships. Until then it remains the active workflow. Do not delete preemptively.
- Phase 0 commit `d3d228d` (10-file numbered hierarchy) — replaced wholesale by this 3-file structure. Original content remains recoverable from that commit.
