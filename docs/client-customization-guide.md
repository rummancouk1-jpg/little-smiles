# Client Customization Guide

This document explains how to fork or re-deploy the Little Smiles Organic SEO Intelligence + ContentOps System for another client without rewriting the core architecture.

The system is intentionally split into:

- **Reusable engines** — content decay, metadata coverage, internal-link suggestions, schema coverage, snapshot insights, publish safety scoring, content calendar, next-best-actions, audit logging. These work for any ecommerce-adjacent site that uses the same blog/product data shape.
- **Client-specific configuration** — catalog, categories, brand styling, credentials, scoring thresholds, publish workflow. These need a per-client pass before launch.

Nothing in this document is public-facing.

---

## 1. What must change per client

### 1.1 Business categories and products

| File | What to change |
| --- | --- |
| `lib/products.ts` | The full product catalog — slugs, names, prices, categories, images, `featured` / `bestSeller` / `inStock` flags. |
| `lib/blog.ts` | Initial seed of published blog posts. (Drafts live in Supabase; published content lives here as static content.) |
| `lib/contentops/blog-schema.ts` | `BlogRelatedProductCategory` union — must mirror the categories used in `lib/products.ts`. |
| `lib/seo-intelligence/content-calendar.ts` | `ALL_CATEGORIES` constant — must mirror the same set. |
| `lib/catalog-config.ts` (if present) | Category metadata, badges, ordering. |
| `public/images/products/` | All product hero images. Must match the paths referenced in `lib/products.ts`. |

> **Validation hook:** `lib/validate-product-images.server.ts` runs at build time and will fail the build if any catalog product references a missing image — keep this enabled.

### 1.2 Content tone

| File | What to change |
| --- | --- |
| `components/contentops/draft-brief-copy-buttons.tsx` | `BRAND_TONE_INSTRUCTION` constant — currently *"warm, parent-friendly, calm, evidence-based. Avoid spammy superlatives…"*. Rewrite to match the new brand voice. |
| `lib/contentops/image-prompts.ts` | `BRAND_STYLE` constant — currently *"soft premium ecommerce, calm cream-and-earth palette…"*. Rewrite for the new visual language. |
| `lib/contentops/improvement.ts` | `buildSectionSuggestions` + `buildFaqSuggestions` — the "Pakistan-specific tips" section and parent-focused FAQs assume a parent-baby retail context. |
| `lib/seo-intelligence/content-calendar.ts` | Template strings (`CLUSTER_TEMPLATES`, `defaultOutline`, `defaultFaqs`) — re-phrase for the new audience. |

### 1.3 GA4 / Search Console credentials

Every connection is **per-deployment env var only** — never commit credentials.

| Source | Required env vars |
| --- | --- |
| GA4 (OAuth, preferred) | `GA4_PROPERTY_ID`, `GA4_OAUTH_CLIENT_ID`, `GA4_OAUTH_CLIENT_SECRET`, `GA4_OAUTH_REFRESH_TOKEN` |
| GA4 (service account, fallback) | `GA4_PROPERTY_ID`, `GA4_CLIENT_EMAIL`, `GA4_PRIVATE_KEY` |
| Search Console | `SEARCH_CONSOLE_CLIENT_EMAIL`, `SEARCH_CONSOLE_PRIVATE_KEY`, `SEARCH_CONSOLE_SITE_URL` |
| Admin-traffic filter | Adjust `ADMIN_PREFIXES` in `lib/seo-intelligence/admin-traffic.ts` if the new client uses a non-`/admin/*` path for their console. |

GA4 + GSC are **read-only**; the system never writes back to either provider.

### 1.4 Supabase project / env vars

| Env var | Purpose |
| --- | --- |
| `SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side admin client (never expose to the browser) |
| `SUPABASE_ANON_KEY` | Browser client (if used by the public site) |

Apply these SQL files in order on a fresh project:

1. Whatever your existing schema files declare for `orders` / `customers` / `order_communications` (out of scope for this guide if reusing).
2. `supabase/contentops-drafts-schema.sql` — the ContentOps drafts table.
3. `supabase/admin-audit-schema.sql` — the audit log table. **Idempotent** (uses `create table if not exists`) and safe to re-run on every deploy.
4. Any GA4 / GSC snapshot tables (`seo_ga4_snapshots`, `seo_gsc_snapshots`) — check `lib/seo-intelligence/snapshots-store.ts` for the latest schema.

### 1.5 Admin authentication

| Env var | Purpose |
| --- | --- |
| `ADMIN_SECRET` | HMAC secret for signing admin session cookies. Generate ≥ 32 random bytes per environment. |
| `ADMIN_USERS_JSON` or equivalent | Allowed admin login identities. See `lib/admin-identity.ts`. |

The admin auth cookie is HttpOnly, SameSite=Lax, and signed with `ADMIN_SECRET`. Rotate `ADMIN_SECRET` to log everyone out.

### 1.6 SEO scoring thresholds

All thresholds live as named constants — adjust per client without touching engine logic.

| File | Constants to tune |
| --- | --- |
| `lib/contentops/draft-validation.ts` | `TITLE_MIN/MAX`, `DESC_MIN/MAX`, `MIN_WORD_COUNT`, `MIN_KEYWORDS`, `MIN_SECTIONS` |
| `lib/contentops/improvement.ts` | `IMPROVEMENT_TARGETS` — long-form word band, FAQ count, section count |
| `lib/contentops/publish-score.ts` | Per-check weights — increase a weight to make that check matter more for the verdict |
| `lib/seo-intelligence/snapshot-insights.ts` | `TOP_N`, `LOW_CTR_THRESHOLD`, `RISING_POSITION_THRESHOLD` |
| `lib/seo-intelligence/link-suggestions.ts` | `MIN_JACCARD_FOR_SUGGESTION`, `MAX_SUGGESTIONS_PER_POST` |
| `lib/seo-intelligence/content-decay.ts` | Age + word-count thresholds |
| `lib/seo-intelligence/content-calendar.ts` | `TARGET_LIMIT_DEFAULT`, `THIN_POST_WORD_FLOOR` |

### 1.7 Brand styling

| File | What to change |
| --- | --- |
| `app/globals.css` | CSS variables for typography + colours. |
| `app/layout.tsx` | Font imports (Plus Jakarta Sans, Cormorant Garamond — replace). |
| `components/navbar.tsx`, `components/site-footer.tsx` | Logo, nav links, footer copy. |
| Hex colour literals across admin components (e.g. `bg-[#FDF8F4]`, `text-[#1F1918]`) | These are hard-coded for the Little Smiles palette. A find-and-replace pass per client is the simplest fix; a longer-term improvement would be to consolidate into Tailwind theme tokens. |
| `app/icon.png`, `app/apple-icon.png`, `app/favicon.ico` | Favicon set. |
| `app/opengraph-image.tsx`, `app/twitter-image.tsx` | Default social cards. |
| `lib/site.ts` | `siteUrl` + brand metadata. |

### 1.8 Publish workflow

The publish flow is intentionally manual — no client should auto-publish.

If the client wants additional pre-publish checks:

- Extend `lib/contentops/publish-prep.ts` (`preparePublish` + conflict codes).
- Add new checks to `lib/contentops/publish-score.ts` (`computePublishSafetyScore`).
- The reviewer UI auto-renders new checks; no UI change usually needed.

If the client uses a CMS instead of the in-repo `lib/blog.ts`:

- Implement a new `PublishAdapter` in `lib/blog-publish-adapter.ts` that talks to the CMS.
- The `preparePublish` pipeline accepts any adapter that implements the contract — no engine rewrite needed.

---

## 2. What stays reusable across clients

These engines are domain-agnostic and ship as-is for the next client:

- **SEO health score** — pillars and weights are configurable, but the composition logic doesn't change.
- **Metadata coverage** — checks every blog + product for title/description/keyword bands.
- **Schema coverage** — checks the data feeding `lib/json-ld.ts`. Schema types are universal.
- **Internal-link suggestion engine** — Jaccard overlap on keywords + anchor-diversity dedup.
- **Content decay** — age + word-count + section-count based.
- **Topic grouping** — Jaccard clusters.
- **Pinterest readiness** — image dimension checks via `sharp`.
- **Snapshot insights** — GA4 + GSC table derivations. Admin-traffic exclusion is configurable.
- **Snapshot history (deltas)** — vs previous / 7d / 30d.
- **Next-best-action engine** — synthesises all engines into a prioritised list. The action templates are domain-agnostic.
- **Publish safety score + verdict** — Ready / Needs Review / Do Not Publish Yet.
- **ContentOps queue + hero image workflow + Improve draft + Prepare publish** — every screen.
- **Audit log + viewer** — fixed action vocabulary works for any client.
- **Data confidence reporting** — High / Active / Low sample / Pending / Disabled / Manual.

---

## 3. Per-client launch checklist

Use this list as the go-live gate.

- [ ] Catalog (`lib/products.ts`) replaced; build runs without missing-image errors.
- [ ] `BlogRelatedProductCategory` union + `ALL_CATEGORIES` updated.
- [ ] At least 1 seed blog post per primary category in `lib/blog.ts`.
- [ ] Brand tone + image-prompt brand style replaced.
- [ ] All hex colour literals reviewed and replaced (search the codebase for `bg-[#` and `text-[#`).
- [ ] Favicon set + social cards replaced.
- [ ] Site URL + organisation metadata replaced (`lib/site.ts`).
- [ ] Robots / sitemap verified — `/admin/*` blocked, no admin URLs in sitemap.
- [ ] `ADMIN_SECRET` generated fresh, `ADMIN_USERS_JSON` populated.
- [ ] Supabase project provisioned, SQL files applied in order.
- [ ] GA4 + Search Console connected; `/admin/readiness` shows green for both.
- [ ] `CRON_SECRET` set; first manual SEO snapshot triggered; audit log shows `seo_snapshot_run` row with `triggerKind: "manual"`.
- [ ] Brand tone + scoring thresholds tuned to client preferences.
- [ ] AI image generation env flags **left unset** for v1 — keeps the system manual.
- [ ] AI assisted improvement env flags **left unset** for v1 unless explicitly requested.
- [ ] Test draft created via `scripts/contentops-draft.ts`; full review → improve → prepare publish flow exercised.
- [ ] `/admin/report` screenshot delivered to client as a sample of what they'll see each cycle.
- [ ] Audit viewer (`/admin/audit`) walked through with the client's primary reviewer.

---

## 4. Out of scope for v1

These would each be standalone projects, not configuration:

- External keyword-volume providers (Ahrefs, Semrush, SERP API).
- Competitor scraping.
- Backlink graph integration.
- Live SERP rank tracking.
- Auto-publishing.
- AI-generated content shipping straight to publish (the path stays human-in-the-loop).

If a client requests any of these, treat them as a paid add-on phase — not a configuration change.
