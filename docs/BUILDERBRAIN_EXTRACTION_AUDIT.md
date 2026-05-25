# BuilderBrain AI — Extraction Audit

**Author:** Claude Opus 4.7, acting as senior architect / ruthless mentor
**Date:** 2026-05-26
**Subject codebase:** `D:\Official\Dev Websites\little-smiles` (Little Smiles editorial / ecommerce app)
**Target new project:** `D:\Official\Dev Websites\BuilderBrain AI` (folder: `builderbrain-ai`)
**Stage:** 1 of 2 — audit only, **no editorial files modified**

---

## TL;DR — mentor read in three lines

1. The honest "reusable %" is closer to **15% code, 60% patterns**. Most of what's transferable is the *shape* of solutions (status-machine stores, snapshot history, cron auth, audit logs, admin session) — not the files themselves, which are tightly coupled to blog/SEO/ecommerce domain. Copy patterns, don't copy code.
2. The single biggest risk is **scope inflation in v0.1**. Shipping all 8 listed features in one pass yields 8 thin stubs. v0.1 should be 4 features done well — the ones that make BuilderBrain feel different from a Notion template — and the rest queued for v0.2.
3. The stack choice (Next 16 + React 19 + Tailwind 4 + shadcn radix-nova + Supabase) is correct and proven. Replicate it. Do **not** invent a new stack. Do **not** make BuilderBrain a workspace inside little-smiles — physical separation is the protection.

---

## A. What already exists that can support BuilderBrain AI

Catalogued by *pattern*, with the canonical reference file in the editorial codebase.

### A1. Status-machine CRUD store pattern
- **Reference:** [lib/contentops/drafts-store.ts](../lib/contentops/drafts-store.ts)
- **Why it matters:** A clean, typed Supabase store wrapping a single table whose rows progress through a status enum (`pending_review → approved → rejected → published`). Includes `countByStatus`, `listByStatus`, `findBySlug`, `slugIndex`, transition helpers (`approveDraft`, `rejectDraft`) that always stamp `updated_at` and the appropriate timestamp column.
- **BuilderBrain mapping:** Maps almost 1:1 onto `decisions`, `prompts`, `handoffs`, `daily_logs`, `tasks` — any entity that has a lifecycle.
- **Recommendation:** Re-implement, do not copy. The file is 215 lines but every type and helper name is blog-specific. Copying produces a confusing diff. The pattern fits in ~80 lines per entity once you internalize it.

### A2. Snapshot-history pattern (time-bounded immutable rows)
- **References:** [lib/seo-intelligence/snapshots-store.ts](../lib/seo-intelligence/snapshots-store.ts) + [supabase/seo-snapshots-schema.sql](../supabase/seo-snapshots-schema.sql)
- **Why it matters:** `upsert by snapshot_date` (natural dedupe), 90-day retention with same-pass pruning, `snapshotIsFresh` helper. The shape is one of the cleanest patterns in the codebase.
- **BuilderBrain mapping:** Daily work log entries, project state snapshots, automation run history.
- **Recommendation:** Pattern is reusable. The GA4/GSC row types are not. Lift the schema shape (`id, snapshot_date unique, window_start, window_end, rows jsonb, row_count, created_at`) and the retention helper concept.

### A3. Admin session + auth shell
- **References:** [lib/admin-auth.ts](../lib/admin-auth.ts) + [components/admin/admin-section-nav.tsx](../components/admin/admin-section-nav.tsx) + [app/admin/layout.tsx](../app/admin/layout.tsx)
- **Why it matters:** HMAC-signed cookie session, 8h TTL, `timingSafeEqual`, dual mode (`secret` vs Supabase email/password), per-page `getAdminSessionFromPage()`, per-request `getAdminSessionFromRequest()`, robots noindex layout.
- **BuilderBrain mapping:** Single-user builder login. Same model — one operator (you), need to keep the surface non-public, no need for full IdP.
- **Recommendation:** **Copy in spirit**, rewrite from scratch. ~110 lines, takes 15 minutes to recreate cleanly with `BUILDERBRAIN_SECRET` env var and `bb_session` cookie. Don't carry over the dual-mode Supabase email/password branch yet — single-user secret mode is enough for v0.1.

### A4. Audit log pattern
- **References:** [lib/admin-audit.ts](../lib/admin-audit.ts) + [supabase/admin-audit-schema.sql](../supabase/admin-audit-schema.sql)
- **Why it matters:** Two entry points — `logAdminAudit(request, payload)` for operator-initiated actions (captures session + IP + UA) and `logSystemAudit(payload)` for cron/system jobs. Both write to the same `admin_audit_logs` table with `actor_label, action, target_type, target_id, metadata jsonb, created_at`. Both no-op silently if Supabase isn't configured. **This is the single most reusable file in the repo.**
- **BuilderBrain mapping:** Directly becomes `activity_events` — every project edit, prompt save, handoff generation, status change can write one row. Becomes the activity feed and the audit trail in one.
- **Recommendation:** Copy the schema 1:1, rename table to `bb_activity_events`. Reimplement the two helpers (trivial).

### A5. Cron Bearer-token auth + structured run records
- **References:** [lib/cron-auth.ts](../lib/cron-auth.ts) + [app/api/cron/contentops-digest/route.ts](../app/api/cron/contentops-digest/route.ts) + [app/api/cron/seo-snapshot/route.ts](../app/api/cron/seo-snapshot/route.ts) + [vercel.json](../vercel.json)
- **Why it matters:** `isAuthorizedCronRequest` with timing-safe Bearer + `?secret=` fallback (operator manual trigger), `getCronAuthDebug` for "why isn't this working" diagnostics, every cron run writes a `logSystemAudit` row with structured metadata (status / reason / counts), graceful env-validation 503s before doing any real work. The `seo-snapshot` route is a masterclass in operability — `?debug=ga4` diagnostic mode classifies failure into named likely-causes.
- **BuilderBrain mapping:** Any future cron (weekly review digest, project staleness sweeper, automation runner).
- **Recommendation:** Copy [lib/cron-auth.ts](../lib/cron-auth.ts) almost verbatim. The cron routes themselves are blog-specific and should be rewritten when needed. The *pattern* of "validate env → auth → run → write audit row → return structured JSON" is the gold standard.

### A6. Supabase admin client with null-graceful degradation
- **Reference:** [lib/supabase-admin.ts](../lib/supabase-admin.ts) (lines 218–300)
- **Why it matters:** `getSupabaseAdminClient()` returns `null` when env is incomplete instead of throwing — every consumer can short-circuit cleanly. `getSupabaseRuntimeChecks()` returns structured info ("has URL", "URL has path suffix", "normalized origin") so the readiness page can show *why* Supabase is broken.
- **BuilderBrain mapping:** Same. The whole app needs to boot and show useful UI even when Supabase isn't connected (matters for local dev / first-run).
- **Recommendation:** Copy verbatim, strip the table types (those are blog-specific). Re-derive a clean `SupabaseSchema` type for BuilderBrain tables only.

### A7. Handoff label derivation (machine signals → human pills)
- **Reference:** [lib/contentops/handoff-labels.ts](../lib/contentops/handoff-labels.ts)
- **Why it matters:** Pure function that turns a verdict + badge set into 1–2 short human-readable pills with a `tone` (positive/info/warning/critical). The wife-friendly framing is the *philosophy* — never make the reviewer translate from machine to action.
- **BuilderBrain mapping:** Project status pills ("Needs spec", "Ready to ship", "Stale 14 days", "Has blocker"). Decision freshness pills. Prompt quality pills.
- **Recommendation:** Reimplement the pattern, not the file. Each entity in BuilderBrain gets its own `derive<Entity>Labels` function with `tone`.

### A8. Empty-queue no-fire digest rule
- **Reference:** [lib/contentops/digest.ts](../lib/contentops/digest.ts) (lines 33–58)
- **Why it matters:** The locked rule "if 0 pending, send nothing" prevents notification fatigue. Engine returns `{ shouldSend: false, skippedReason: "empty_queue" }`; route audits and exits.
- **BuilderBrain mapping:** Weekly project review digest, stale-project alerts, "prompts you saved but never used" reminders. **Same rule applies.**
- **Recommendation:** Copy the rule as a documented invariant in BuilderBrain's notification spec. Don't copy the file (Resend-coupled, blog-specific subject lines).

### A9. Next-best-action synthesis pattern
- **Reference:** [lib/seo-intelligence/next-best-actions.ts](../lib/seo-intelligence/next-best-actions.ts) (header comment + types are the value)
- **Why it matters:** Multiple deterministic upstream engines → prioritized action list with `priority / effort / impact / reason / relatedHref / source` per row. No fake data — every action has a verifiable footprint.
- **BuilderBrain mapping:** **Killer feature for BuilderBrain.** Each project has a "next best action" derived from its memory + last activity + stale decisions. Per-project and per-portfolio views.
- **Recommendation:** Adopt the *type signature* (`NextBestAction`) almost verbatim. Write a project-aware engine that synthesises from BuilderBrain's own entities. This becomes one of the v0.1 differentiators.

### A10. Card / Button / Badge / Dialog / Tabs primitives
- **Reference:** [components/ui/](../components/ui/)
- **Why it matters:** Already shadcn `radix-nova` style, Tailwind 4, `data-slot` attributes, `cn()` util. Solid base.
- **BuilderBrain mapping:** Install fresh via `shadcn` CLI. No reason to copy.
- **Recommendation:** **Do not copy.** Run shadcn init in the new project. You'll get the same primitives, cleanly versioned, no inheritance.

---

## B. Editorial / blog-specific — DO NOT extract

These should not appear in BuilderBrain in any form. They will leak Little Smiles domain.

| File / folder | Why it stays |
|---|---|
| [lib/contentops/blog-schema.ts](../lib/contentops/blog-schema.ts) | BlogPost zod, category enums tied to Little Smiles products |
| [lib/contentops/publish-prep.ts](../lib/contentops/publish-prep.ts), [publish-score.ts](../lib/contentops/publish-score.ts), [publish-types.ts](../lib/contentops/publish-types.ts) | Blog publish-readiness verdict engine |
| [lib/contentops/draft-validation.ts](../lib/contentops/draft-validation.ts) | Blog-specific badges (thin content, missing hero, etc.) |
| [lib/contentops/hero-image.ts](../lib/contentops/hero-image.ts), [image-prompts.ts](../lib/contentops/image-prompts.ts), [lifestyle-images.ts](../lib/contentops/lifestyle-images.ts) | Image orchestration tied to /public/products |
| [lib/contentops/improvement.ts](../lib/contentops/improvement.ts) | Blog-draft improvement loop |
| [lib/blog-publish-adapter.ts](../lib/blog-publish-adapter.ts), [lib/blog.ts](../lib/blog.ts) | Blog rendering pipeline |
| [lib/seo-intelligence/](../lib/seo-intelligence/) (entire folder except patterns noted in A) | GA4 / GSC providers, content decay, keyword opportunities, internal linking — all SEO domain |
| [lib/providers/](../lib/providers/) | GA4 + Search Console SDK wrappers |
| [components/contentops/](../components/contentops/) (entire folder) | Draft queue + draft detail + hero-image panel + publish-control — all blog UI |
| [app/admin/contentops/](../app/admin/contentops/), [app/admin/seo/](../app/admin/seo/), [app/admin/keywords/](../app/admin/keywords/), [app/admin/readiness/](../app/admin/readiness/), [app/admin/report/](../app/admin/report/) | Editorial admin surfaces |
| [app/api/cron/contentops-digest/](../app/api/cron/contentops-digest/), [seo-snapshot/](../app/api/cron/seo-snapshot/), [communications-retries/](../app/api/cron/communications-retries/) | Editorial / ecommerce cron jobs |
| [app/(public storefront)](../app/) — `shop/`, `cart/`, `blog/`, `track-order/`, `reviews/`, `best-sellers/`, all policy pages | Storefront entirely |
| [components/cart-*.tsx](../components/), [components/product-*.tsx](../components/), [components/admin/order*.tsx](../components/admin/), [components/admin/notifications-table.tsx](../components/admin/notifications-table.tsx) | Ecommerce UI |
| [data/](../data/) (catalog.json, site.json) | Boutique catalog |
| [public/products/](../public/products/), [public/blog/](../public/blog/) | Boutique image assets |
| [lib/order-*.ts](../lib/), [lib/cart-*.ts](../lib/), [lib/orders.ts](../lib/orders.ts), [lib/products.ts](../lib/products.ts), [lib/catalog-config.ts](../lib/catalog-config.ts), [lib/testimonials.ts](../lib/testimonials.ts), [lib/shipping-faq.ts](../lib/shipping-faq.ts), [lib/home-trust-content.ts](../lib/home-trust-content.ts), [lib/commercial-seo.ts](../lib/commercial-seo.ts), [lib/json-ld.ts](../lib/json-ld.ts), [lib/seo-metadata.ts](../lib/seo-metadata.ts), [lib/validate-product-images.server.ts](../lib/validate-product-images.server.ts) | Storefront business logic |
| [scripts/](../scripts/) — except as one-off reference for tsx pattern | Storefront scripts (catalog validation, image audit) |

---

## C. Useful but rebuild cleaner from scratch

Where the editorial system has battle scars, BuilderBrain gets to start without them.

| Concern | Editorial approach | BuilderBrain rebuild |
|---|---|---|
| **Theme** | Warm-neutral boutique palette baked in as `bg-[#FDF8F4]` inline literals across pages. Shadcn variables exist in [globals.css](../app/globals.css) but admin pages don't use them. | Use shadcn variables (`bg-background`, `text-foreground`, `border`, `muted`) consistently. Pick a neutral zinc + a single accent. Executive SaaS feel = restraint, not custom palettes. |
| **Admin layout** | Each admin page redeclares its `<main>` wrapper with the same boutique colors. | One shared `<DashboardShell>` component, props for title / breadcrumbs / actions. |
| **Auth** | Two modes (secret + Supabase) gated by `ADMIN_AUTH_MODE`. | Single secret mode in v0.1. Wrap the session helper so adding Supabase Auth later is a single-file change. |
| **Type-safe Supabase schema** | Hand-written `SupabaseSchema` in [lib/supabase-admin.ts](../lib/supabase-admin.ts) for 10+ tables. Drift-prone. | Either (a) keep small and hand-write for v0.1 (3–5 tables), or (b) wire `supabase gen types` from day 1 if you'll touch many tables. Prefer (a) until table count crosses ~7. |
| **Mixed inline styling vs. tokens** | `text-[#3B2F2F]/72` and `bg-[#FDF8F4]` everywhere. Brand-coupled. | Token-only. Strict — reject any PR with raw hex Tailwind brackets except in `globals.css`. |
| **Notification fan-out** | WhatsApp + email both wired; WhatsApp via Twilio. | v0.1: email only, via Resend. WhatsApp can wait. |

---

## D. What should become BuilderBrain AI v0.1

**Mentor pushback on the listed 8 features:**

You asked for 8 features in v0.1. Building all 8 in one session produces 8 thin stubs that look impressive in screenshots and feel hollow in use. The actual v0.1 should be the **4 features that make BuilderBrain feel like a second brain instead of a Notion template**, plus enough chrome that the other 4 are obviously coming next.

**Recommended v0.1 scope (in build order):**

1. **Project Dashboard** — list, status, last-worked, completion %, priority, next-action chip. (Listed feature #1.)
2. **Project Memory Page** — the most differentiated feature. What this project is, architecture, key files, completed/pending, known bugs, deploy notes, future ideas, important links. (Listed feature #2.) **This is the page that justifies the product.**
3. **Decision Log** — title, detail, project, reason, impact, date, tags. Cheap to build, high recall value. (Listed feature #3.)
4. **AI Handoff Generator** — generate structured prompts (Cursor / Claude / GPT / client-update) from a project + selected memory chunks. **The killer feature for AI-assisted developers.** (Listed feature #5.)

**Defer to v0.2:**

5. **Prompt Vault** — valuable, but redundant with the Handoff Generator at v0.1 scale. Add when you have 20+ saved prompts.
6. **Daily Work Log** — easy to add, but its value compounds over months. Ship empty in v0.1, fill it from real use.
7. **Search & Filter** — proper search needs ≥3 entities populated to be useful. Per-section filtering in v0.1 is enough.
8. **Client Management** — Little Smiles is solo; you have ~0–2 client projects today. Add when you actually have 4+.

**Why this scope, in one sentence:** A Project Memory page + a Handoff Generator is something nobody else has built well, and that's what makes you open the app daily — Prompt Vault and Daily Log are table stakes you can add in week 3.

---

## E. Recommended standalone architecture

```
┌────────────────────────────────────────────────────────────────┐
│  BuilderBrain AI — Next.js 16 app, single deployable           │
│                                                                │
│  app/                                                          │
│    (public)/                       (only the login screen)     │
│      login/                                                    │
│    (app)/                          (everything is gated)       │
│      page.tsx                      Dashboard (Projects)        │
│      projects/                                                 │
│        [projectId]/                                            │
│          page.tsx                  Project home (Memory page)  │
│          decisions/                                            │
│          prompts/                                              │
│          handoffs/                                             │
│      decisions/                    Cross-project log           │
│      prompts/                                                  │
│      handoffs/new/                 Handoff generator           │
│      settings/                                                 │
│    api/                                                        │
│      projects/...                                              │
│      decisions/...                                             │
│      handoffs/generate/            Anthropic SDK call          │
│      auth/login/                                               │
│      auth/logout/                                              │
│      cron/                         (later)                     │
│                                                                │
│  components/                                                   │
│    ui/                             shadcn primitives           │
│    shell/                          DashboardShell, SectionNav  │
│    projects/                                                   │
│    decisions/                                                  │
│    handoffs/                                                   │
│                                                                │
│  lib/                                                          │
│    auth/                           HMAC session                │
│    db/                             Supabase client + types     │
│    activity/                       activity_events writer      │
│    handoffs/                       prompt templates + engine   │
│    next-best-action/               cross-entity synthesis      │
│                                                                │
│  data/                             mock seed JSON (v0.1)       │
│  supabase/                         schema SQL files            │
│  docs/                                                         │
└────────────────────────────────────────────────────────────────┘
```

**Key architectural choices:**

- **Single deployable.** No microservices, no separate worker. Vercel hosts everything; Vercel Cron handles future scheduled jobs.
- **Supabase from day 1, mock data optional.** Same pattern as little-smiles: `getSupabaseAdminClient()` returns `null` when unconfigured, app degrades gracefully to a JSON seed file. This lets you run the app immediately with no DB and switch to Supabase whenever you wire it up.
- **Server components by default.** Client components only for forms, drag/drop, modals.
- **No multi-tenant scaffolding.** Single user, single tenant. When (if) it becomes SaaS, add `workspace_id` columns and RLS in one migration.
- **No LangChain / orchestration framework.** Direct Anthropic SDK calls, same as ContentOps.

---

## F. Recommended folder structure for `D:\Official\Dev Websites\BuilderBrain AI`

The product name is **BuilderBrain AI** (UI, README, docs). The OS folder uses kebab-case for tooling:

```
D:\Official\Dev Websites\BuilderBrain AI\
└── builderbrain-ai\                  ← the actual git repo / npm project
    ├── README.md
    ├── AGENTS.md                     ← AI assistant instructions (same shape as little-smiles)
    ├── AI_CONTEXT.md
    ├── PROJECT_STATUS.md
    ├── package.json
    ├── tsconfig.json
    ├── next.config.ts
    ├── postcss.config.mjs
    ├── components.json               ← shadcn config
    ├── eslint.config.mjs
    ├── .env.example
    ├── app/
    ├── components/
    ├── lib/
    ├── data/
    │   └── seed.json                 ← initial mock data
    ├── public/
    ├── supabase/
    │   ├── projects-schema.sql
    │   ├── decisions-schema.sql
    │   ├── prompts-schema.sql
    │   ├── handoffs-schema.sql
    │   ├── activity-events-schema.sql
    │   └── README.md                 ← run order, idempotency notes
    ├── docs/
    │   ├── ARCHITECTURE.md
    │   ├── ROADMAP.md
    │   └── DECISIONS_LOG.md          ← BuilderBrain dogfoods itself
    └── scripts/
        └── seed-from-mock.ts         ← one-shot to write seed.json into Supabase
```

**Why a nested folder under "BuilderBrain AI":** The OS folder with the human-readable name lets you keep multiple repos there later (web app, docs site, marketing site if it goes SaaS) without renaming. The `builderbrain-ai` child is what npm / git / Vercel see.

---

## G. Risks of extraction

| # | Risk | Mitigation |
|---|---|---|
| R1 | **"20–25% reusable" turns out to be ~15% in practice.** Code looks more general than it is; copying inherits blog assumptions. | Audit confirmed this. Recommendation: copy *zero* files. Copy patterns, recreate clean. |
| R2 | **Stack version drift between the two repos.** Little Smiles is on bleeding edge (Next 16.2.4, React 19.2.4, Tailwind 4, shadcn radix-nova style, Anthropic SDK 0.96). | Pin BuilderBrain to the same exact versions in v0.1. Upgrade in lockstep. After v0.2, decouple. |
| R3 | **Cross-repo coupling via a "shared" package.** Tempting to extract `lib/admin-auth.ts` into `@rumman/shared-admin`. | **Don't.** Two separate apps with intentional code duplication is cheaper than a shared package you have to version. Revisit at v1.0. |
| R4 | **Multi-tenant / SaaS design from day 1.** Slows v0.1 by 3–5x for capability you don't need for months. | Single-user single-tenant. No `workspace_id` columns yet. Use Postgres tables, not RLS-gated multi-tenant schemas. |
| R5 | **Editorial system gets quietly broken** by a careless "shared" edit. | Stage 1 (this audit) does not modify any editorial file. Stage 2 creates BuilderBrain in a sibling folder; no edits to little-smiles. Re-confirm before any commit. |
| R6 | **AI prompt costs balloon** if handoff generator calls Opus for every request. | Default to Sonnet 4.6 for generation, Haiku 4.5 for short templated handoffs. Opus only for explicit "deep" mode. Same model split as ContentOps. |
| R7 | **Feature creep in v0.1.** All 8 features looks like progress; it isn't. | Hard rule: v0.1 ships 4 features. The other 4 stay in [ROADMAP.md](#) with explicit deferral notes. |

---

## H. Exact files / folders / components / routes / services to:

### Copy verbatim (or near-verbatim)

**None.** Every file worth referencing is also worth rewriting cleaner with BuilderBrain's vocabulary. Direct copy would litter the new repo with `// TODO rename from Little Smiles` comments and stale doc strings.

### Reference closely while rewriting (read these while building the equivalent in BuilderBrain)

| BuilderBrain file to write | Reference in little-smiles |
|---|---|
| `lib/auth/session.ts` | [lib/admin-auth.ts](../lib/admin-auth.ts) |
| `lib/db/supabase.ts` | [lib/supabase-admin.ts](../lib/supabase-admin.ts) (strip blog table types) |
| `lib/activity/events.ts` | [lib/admin-audit.ts](../lib/admin-audit.ts) |
| `lib/cron/auth.ts` | [lib/cron-auth.ts](../lib/cron-auth.ts) (verbatim concept) |
| `supabase/activity-events-schema.sql` | [supabase/admin-audit-schema.sql](../supabase/admin-audit-schema.sql) |
| `lib/db/projects-store.ts`, `decisions-store.ts`, `prompts-store.ts`, `handoffs-store.ts` | [lib/contentops/drafts-store.ts](../lib/contentops/drafts-store.ts) |
| `lib/next-best-action/engine.ts` | [lib/seo-intelligence/next-best-actions.ts](../lib/seo-intelligence/next-best-actions.ts) (type signatures) |
| `components/shell/DashboardShell.tsx`, `SectionNav.tsx` | [components/admin/admin-section-nav.tsx](../components/admin/admin-section-nav.tsx) |

### Avoid entirely (do not reference, do not adapt)

Everything in **Section B** above.

### Rewrite-clean targets (where the editorial version is worth knowing about, but BuilderBrain should be cleaner)

- Theme system — use shadcn vars exclusively, no inline hex literals.
- Page shells — one shared `<DashboardShell>` instead of per-page boilerplate.
- Notification provider — start with Resend only; abstract the interface so adding channels later is a no-op.

---

## I. Data model recommendation for BuilderBrain AI

Postgres / Supabase. All tables get `id uuid primary key default gen_random_uuid()`, `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()` unless noted.

**Note:** No `user_id` / `workspace_id` columns in v0.1 — single-tenant. When SaaS happens, those become a follow-up migration with `where user_id = auth.uid()` RLS.

### `bb_projects`
| column | type | notes |
|---|---|---|
| id | uuid | PK |
| name | text not null | display name |
| slug | text not null unique | URL-safe |
| status | text not null check in (`active`, `paused`, `client_ready`, `experimental`, `archived`) | |
| priority | int not null default 3 check between 1 and 5 | 1 = highest |
| completion_pct | int not null default 0 check between 0 and 100 | |
| risk_level | text not null default 'low' check in (`low`, `medium`, `high`) | |
| summary | text null | one-paragraph what-is-it |
| repo_url | text null | |
| deployed_url | text null | |
| last_worked_at | timestamptz null | updated on any related activity_event |
| created_at, updated_at | timestamptz | |

### `bb_project_memories`
One row per project (1:1). Holds the long-form Project Memory Page content as structured JSONB so the editor can be section-aware without a schema migration per section type.

| column | type | notes |
|---|---|---|
| id | uuid | PK |
| project_id | uuid not null references bb_projects(id) on delete cascade unique | |
| sections | jsonb not null default '[]' | array of `{ id, kind, title, body_md }` where `kind ∈ (overview, architecture, key_files, completed, pending, known_bugs, deploy_notes, future_ideas, links)` |
| updated_at | timestamptz | |

### `bb_decisions`
| column | type | notes |
|---|---|---|
| id | uuid | PK |
| project_id | uuid null references bb_projects(id) on delete set null | nullable — some decisions span projects |
| title | text not null | |
| detail_md | text not null | the actual decision |
| reason_md | text null | why |
| impact | text not null check in (`low`, `medium`, `high`) default 'medium' | |
| decided_on | date not null default current_date | |
| tags | text[] not null default '{}' | |
| created_at | timestamptz | |

### `bb_prompts`
| column | type | notes |
|---|---|---|
| id | uuid | PK |
| project_id | uuid null references bb_projects(id) on delete set null | |
| title | text not null | |
| body_md | text not null | the prompt itself |
| target_tool | text not null check in (`gpt`, `claude`, `cursor`, `other`) | |
| purpose | text null | |
| quality_rating | int null check between 1 and 5 | |
| tags | text[] not null default '{}' | |
| use_count | int not null default 0 | incremented when "Use" button fires |
| created_at, updated_at | timestamptz | |

### `bb_handoffs`
| column | type | notes |
|---|---|---|
| id | uuid | PK |
| project_id | uuid not null references bb_projects(id) on delete cascade | |
| kind | text not null check in (`cursor_impl`, `claude_audit`, `gpt_plan`, `client_update`) | |
| input | jsonb not null | `{ selected_memory_section_ids, focus_question, extra_context }` |
| output_md | text not null | the generated handoff prompt |
| model | text not null | e.g. `claude-sonnet-4-6` |
| created_at | timestamptz | |

### `bb_daily_logs`  *(scaffold in v0.1, write from v0.2)*
| column | type | notes |
|---|---|---|
| id | uuid | PK |
| log_date | date not null default current_date | |
| project_id | uuid null references bb_projects(id) on delete set null | |
| worked_on_md | text not null | |
| changed_md | text null | |
| blockers_md | text null | |
| next_action_md | text null | |
| created_at | timestamptz | |

### `bb_activity_events`
The audit / activity feed. Same shape as `admin_audit_logs` from little-smiles.

| column | type | notes |
|---|---|---|
| id | uuid | PK |
| actor_label | text not null | "operator" or "system_cron" |
| action | text not null | e.g. `project.created`, `decision.added`, `handoff.generated` |
| target_type | text null | e.g. `project`, `decision` |
| target_id | text null | UUID of the target |
| project_id | uuid null references bb_projects(id) on delete set null | for fast per-project feeds |
| metadata | jsonb null | |
| created_at | timestamptz | |

### Intentionally deferred to v0.2+

- `bb_clients` — single-user has at most a handful of clients; track as a `tags` field on `bb_projects` first.
- `bb_tasks` — until you actually use it, it duplicates `bb_daily_logs.next_action_md`.
- `bb_automations` — wait until you have one real automation to run.
- `bb_files_or_references` — `bb_project_memories.sections[kind='links']` is enough.
- `bb_tags` as a first-class table — `text[]` columns cover v0.1.

### Mock-data fallback

`data/seed.json` mirrors these tables. On boot, if Supabase is `null`, every store helper reads from the seed file instead. Same pattern as little-smiles `catalog.json`.

---

## J. Implementation plan for the next phase (Stage 2)

### J0. Scope confirmation (blocker for Stage 2)

Before writing any code, confirm with user:

1. **v0.1 feature scope:** the recommended 4 (Dashboard, Memory Page, Decision Log, Handoff Generator) vs. all 8.
2. **Storage:** Supabase from day 1 (write schema, run later) vs. JSON-only mock data in v0.1.
3. **Theme:** neutral SaaS palette (zinc + one accent) vs. warm/editorial (carry boutique aesthetic).
4. **Anthropic SDK usage in v0.1:** wire the live Handoff Generator end-to-end (needs `ANTHROPIC_API_KEY` in env), or stub it with a template-only handoff for v0.1 and add the SDK in v0.2.

### J1. Scaffold (≤ 30 min)

- `npx create-next-app@latest builderbrain-ai --typescript --tailwind --app --eslint`
- Pin Next 16.2.4, React 19.2.4, Tailwind 4 to match little-smiles.
- `npx shadcn@latest init` with the same `radix-nova` style.
- Add `@supabase/supabase-js`, `@anthropic-ai/sdk`, `zod`, `lucide-react`.
- Create `AGENTS.md` with the same Next 16 docs warning.
- Create `.env.example` listing `BUILDERBRAIN_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `CRON_SECRET`.

### J2. Foundation layer (≤ 1 hr)

- `lib/db/supabase.ts` — null-graceful client (mirror little-smiles pattern).
- `lib/auth/session.ts` — HMAC cookie session.
- `lib/activity/events.ts` — audit / activity event writer.
- `data/seed.json` — initial mock data (2 sample projects, 3 decisions, 2 prompts, 1 handoff).
- `lib/db/projects-store.ts`, `decisions-store.ts`, `prompts-store.ts`, `handoffs-store.ts` — each with `seed-fallback` mode.

### J3. Shell + dashboard (≤ 1 hr)

- `components/shell/DashboardShell.tsx` — sidebar + topbar + main slot.
- `components/shell/SectionNav.tsx` — sidebar entries with active state.
- `app/(app)/page.tsx` — Project Dashboard with status, priority, completion, last-worked, next-action.
- `app/(public)/login/page.tsx` — single-input password form.

### J4. Project Memory Page (≤ 1.5 hr)

- `app/(app)/projects/[projectId]/page.tsx` — server component, reads memory + recent activity.
- Section editor with the 9 section kinds. Markdown only, no rich text.
- Auto-save on blur.

### J5. Decision Log (≤ 1 hr)

- `app/(app)/decisions/page.tsx` — list with filter by project / tag / impact.
- `app/(app)/decisions/new/page.tsx` — create form.
- `app/(app)/projects/[projectId]/decisions/page.tsx` — same list, project-filtered.

### J6. AI Handoff Generator (≤ 2 hr)

- `app/(app)/handoffs/new/page.tsx` — pick project, pick memory sections, pick kind, focus question.
- `app/api/handoffs/generate/route.ts` — server route, calls Anthropic SDK, persists output to `bb_handoffs`.
- 4 prompt templates (`lib/handoffs/templates.ts`) — one per `kind`.
- Output page with copy button + "regenerate" affordance.

### J7. Polish + docs (≤ 1 hr)

- `README.md` — vision, run instructions, next phases.
- `docs/ARCHITECTURE.md` — locked decisions.
- `docs/ROADMAP.md` — v0.2 (Prompt Vault, Daily Log, Search), v0.3 (Automations, Clients), v1.0 (multi-tenant).
- Final implementation report in `docs/IMPLEMENTATION_REPORT.md`.

**Estimated total Stage 2 time: 7–8 hours of focused build.** Realistically this is two sessions. A one-session attempt produces lower quality across the board.

### J8. Explicit non-goals for Stage 2

- ❌ No multi-tenant scaffolding.
- ❌ No prompt vault UI (defer to v0.2).
- ❌ No daily log UI (defer to v0.2).
- ❌ No cross-entity search (defer to v0.2; per-section filtering is enough).
- ❌ No dark mode toggle in v0.1 (set defaults that look good in both, but don't ship a switch).
- ❌ No copy-paste of editorial code. Every file is fresh.

---

## Appendix — files & folders the audit actually read

For provenance, these are the files this audit inspected directly:

- `package.json`, `tsconfig.json`, `next.config.ts`, `vercel.json`, `components.json`
- `AGENTS.md`, `CLAUDE.md`, `AI_CONTEXT.md`, `PROJECT_STATUS.md`
- `app/admin/layout.tsx`, `app/admin/contentops/page.tsx`, `app/admin/seo/page.tsx`
- `app/globals.css`
- `app/api/cron/contentops-digest/route.ts`, `app/api/cron/seo-snapshot/route.ts`
- `components/admin/admin-section-nav.tsx`
- `components/contentops/draft-queue.tsx`
- `components/ui/card.tsx`
- `lib/admin-auth.ts`, `lib/admin-audit.ts`, `lib/cron-auth.ts`, `lib/supabase-admin.ts`
- `lib/contentops/drafts-store.ts`, `lib/contentops/digest.ts`, `lib/contentops/handoff-labels.ts`, `lib/contentops/blog-schema.ts`
- `lib/seo-intelligence/snapshots-store.ts`, `lib/seo-intelligence/next-best-actions.ts`
- `supabase/admin-audit-schema.sql`, `supabase/contentops-schema.sql`, `supabase/seo-snapshots-schema.sql`
- `docs/contentops-ai/ARCHITECTURE.md`
- Folder listings of `app/`, `lib/`, `components/`, `scripts/`, `supabase/`, `docs/`, `app/api/`, `app/admin/`

This is enough surface to be confident in the recommendations above. Anything that didn't get read is implicitly in the "do not extract" category — if it wasn't worth quoting, it isn't worth copying.

---

**End of audit. Awaiting scope confirmation before Stage 2.**
