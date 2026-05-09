# Project status — Little Smiles

Snapshot of **current** production readiness and engineering state. Update this file when shipping major changes.

## Production readiness

| Capability | Status |
|------------|--------|
| Public storefront (shop, PDP, blog, policies) | **Ready** — static/SSG paths build cleanly |
| Cart (client persistence + `/cart`) | **Ready** |
| WhatsApp checkout (single + cart) | **Ready** |
| Order intent logging | **Ready** when Supabase + `order_intents` exist |
| Admin (orders, intents, audit) | **Ready** when auth + Supabase configured |
| Contact form email | **Ready** when Resend + addresses configured |
| Track order | **Ready** when Supabase + `orders` populated |
| Customer SMS/WhatsApp from admin | **Optional** — requires Twilio or webhook env |
| Cron retries | **Ready** when `CRON_SECRET` + Vercel Cron + communications rows exist |

**Blockers for a minimal “full stack” production cut:** valid `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, admin authentication vars, and a database schema that includes **`order_intents`** (referenced by `orders`) plus tables in `supabase/*.sql`. Without Supabase, the **public site and cart still work**; intents, admin, and track-order degrade gracefully or return errors as coded.

## Completed systems / features

- Next.js App Router site with **Tailwind 4** and premium soft ecommerce UI
- **JSON catalog** with build-time validation and image checks (non-prod)
- **SEO**: metadata helpers, sitemap, robots, OG routes
- **WhatsApp-first** flows with PostHog (`whatsapp_order_clicked`, `cart_whatsapp_checkout_clicked`)
- **Persistent cart** (`little-smiles-cart-v1`), catalog validation, limited-stock messaging
- **Order intents API** + optional Supabase insert
- **Admin** area: intents, orders, notifications, audit; secret or Supabase login
- **Order communications** queue with retries and scheduled cron processor
- **Sentry** and **GA** / **PostHog** integration points
- **RUNBOOK.md** for operators

## Remaining blockers (honest gaps)

- **`order_intents` DDL** not checked into `supabase/`; must exist in Supabase for FK from `orders` and for intent logging—coordinate with `RUNBOOK.md` / DBA
- **No automated E2E** test suite in CI
- **Payment gateway** intentionally absent—still manual confirmation
- **Inventory** is file-based; real-time stock across channels is not modeled

## Nice-to-have improvements

- Checked-in migration for `order_intents` + idempotent full schema package
- E2E tests (Playwright) for cart + checkout message smoke
- Structured logging / metrics dashboard for intent → order conversion
- Email templates for order updates (beyond SMS/WhatsApp)
- Multi-currency or non-PKR display (currently PKR-focused)

## Known limitations

- Cart is **per-browser** (`localStorage`); no server-side cart or merge across devices
- **Single-merchant** model; no multi-tenant admin
- **Twilio/webhook** notifications depend on correct env and Pakistani number formatting
- **Rate limits** on public APIs are in-memory style per deployment (see `lib/request-rate-limit.ts` patterns)—not a distributed Redis layer unless extended

## Architecture maturity

- **Storefront:** mature for a boutique static-catalog site
- **Operations:** solid for small-team manual fulfillment; not a full OMS/ERP
- **Auth:** appropriate for internal admin; not customer accounts

## Deployment / platform

- **Vercel** for hosting and **GitHub** for source
- **vercel.json** cron: daily communication retries (`0 12 * * *` UTC)
- **Supabase** as managed Postgres

## Recent major milestones

- Introduction of **persistent cart**, `/cart`, and cart-level WhatsApp message builder
- Rebalanced UI: **Add to cart** primary on cards; WhatsApp as secondary / checkout capstone
- **PostHog** cart checkout event + non-blocking order-intent logging for cart
- **Button** `className` merge fix for shadcn-style components
- **Mobile nav** cart row + footer CTA for cart access

## Suggested roadmap (not committed)

1. Commit full Supabase migration set (including `order_intents`) and CI check
2. Playwright smoke: add to cart → open WhatsApp URL contains expected SKUs
3. Admin: bulk status updates hardened + export improvements
4. Optional: Edge-config or KV for rate limits if traffic grows
5. Optional: Customer order portal (magic link) without full auth product
