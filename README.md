# Little Smiles

Premium baby boutique storefront and lightweight operations stack for Pakistan: catalog site, WhatsApp-led checkout, optional Supabase-backed order workflow, and an internal admin.

## Overview

Little Smiles is a **Next.js (App Router)** marketing and commerce site. Products and pricing are driven by **`data/catalog.json`** and **`data/site.json`** (validated at build time). There is **no hosted payment gateway**; customers complete purchases by messaging on **WhatsApp**. A **persistent browser cart** (`localStorage`) improves selection UX; checkout still opens WhatsApp with a prefilled multi-item message.

## Tech stack

| Area | Technology |
|------|------------|
| Framework | **Next.js 16** (App Router, React 19) |
| Styling | **Tailwind CSS 4**, **shadcn/ui**-style components, **Motion** |
| Content | Static catalog JSON, blog MD/TS modules |
| Database / backend | **Supabase** (Postgres) via **service role** from server routes only |
| Email | **Resend** (`/api/contact`) |
| Analytics | **Google Analytics** (`NEXT_PUBLIC_GA_ID`), **PostHog** (client) |
| Errors | **Sentry** (`@sentry/nextjs`) |
| Hosting | **Vercel** (GitHub integration, cron) |

## Main features

- **Shop & PDPs**: Category filters, product detail, SEO metadata, sitemap (cart excluded).
- **Cart**: Versioned `localStorage` key `little-smiles-cart-v1`; lines store `productSlug` + `quantity`; catalog is source of truth for price, images, stock.
- **WhatsApp checkout**: Prefilled messages from product pages, listing cards, navbar, and **cart summary** on `/cart`.
- **Order intents**: `POST /api/order-intent` logs anonymous click/intent rows (non-blocking for users).
- **Track order**: `/track-order` + `POST /api/track-order` (phone + order ref, rate limited).
- **Contact**: `/contact` + `POST /api/contact` (Resend when configured).
- **Admin**: `/admin/*` — order intents, orders, notifications, audit log (auth: shared secret cookie or Supabase email mode).

## Local development

**Requirements:** Node.js compatible with Next 16 (see `package.json`), npm.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Catalog validation** runs automatically before `npm run build` (`prebuild` → `validate:catalog`). Fix `data/catalog.json` if validation fails.

**Strict env (production):** `instrumentation.ts` calls `assertRuntimeEnvAtStartup()` on the Node runtime. For local dev, missing vars log warnings unless you mimic production strictness.

## Environment variables (names only)

Never commit secrets. Set values in `.env.local` (local) or the Vercel project dashboard.

**Core / Supabase**

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY` — required when `ADMIN_AUTH_MODE=supabase`

**Admin auth**

- `ADMIN_AUTH_MODE` — `secret` (default) or `supabase`
- `ADMIN_SECRET` — password for secret mode (session signing)
- `ADMIN_ALLOWED_EMAILS` — allowlist (Supabase mode)
- `ADMIN_DEFAULT_LABEL` — optional actor label

**Cron**

- `CRON_SECRET` — `Authorization: Bearer …` for `/api/cron/communications-retries`

**Contact email**

- `RESEND_API_KEY`
- `CONTACT_TO_EMAIL`
- `CONTACT_FROM_EMAIL`

**Analytics & product analytics**

- `NEXT_PUBLIC_GA_ID`
- `NEXT_PUBLIC_POSTHOG_KEY`
- `NEXT_PUBLIC_POSTHOG_HOST` — optional (defaults to PostHog cloud)

**Observability**

- `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`
- `SENTRY_ORG`, `SENTRY_PROJECT` — source map upload during build

**Order customer notifications (optional)**

- `ORDER_NOTIFICATION_PROVIDER` — e.g. `twilio`, `webhook`, or unset (simulated / noop paths)
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_SMS_FROM`, `TWILIO_WHATSAPP_FROM`
- `ORDER_NOTIFICATION_WEBHOOK_URL`
- `ORDER_COMMUNICATION_MAX_RETRIES`

**Webhooks / ancillary**

- `WHATSAPP_CLICK_WEBHOOK_URL` or `CONTACT_NOTIFY_WEBHOOK_URL` — server event logging for WhatsApp clicks (see `app/api/events/whatsapp-order`)

**Build / ops**

- `RUNTIME_ENV_STRICT` — set to `false` to avoid throwing on failed env validation in production (use sparingly)
- `ANALYZE` — bundle analyzer
- `VERCEL_GIT_COMMIT_DATE` — set by Vercel for sitemap freshness

**Smoke scripts (CI / manual)**

- `SMOKE_BASE_URL`, `SMOKE_ADMIN_PASSWORD`, `SMOKE_ADMIN_EMAIL`, `SMOKE_CUSTOMER_PHONE`

## Deployment workflow (GitHub + Vercel)

1. Push to the connected Git branch; Vercel builds with `npm run build`.
2. Configure **all required environment variables** in the Vercel project (Production + Preview as needed).
3. **Supabase**: run SQL migrations / confirm tables (see `RUNBOOK.md` and `supabase/*.sql`).
4. **Cron**: `vercel.json` schedules `GET /api/cron/communications-retries` daily; set `CRON_SECRET` and ensure Vercel Cron is enabled for the project.

## Supabase usage overview

- **Server-only** access via `SUPABASE_SERVICE_ROLE_KEY` for APIs and admin pages (never expose the service role to the browser).
- **Typical tables**: `order_intents`, `orders`, `order_status_history`, `customers`, `order_communications`, `admin_audit_logs`. Column-level detail is in `lib/supabase-admin.ts` types and `supabase/orders-schema.sql` / `supabase/admin-audit-schema.sql`.
- **Note:** `orders` references `order_intents`; ensure `order_intents` exists in the database before relying on FKs (DDL for `order_intents` may be maintained outside this repo—align with `RUNBOOK.md`).

## Cart + WhatsApp checkout overview

- Cart state: **`little-smiles-cart-v1`** in `localStorage`; validated against live catalog on load and on tab visibility.
- **Add to cart** appears on grids, PDP, related products; navbar and mobile shop sticky surfaces link to `/cart`.
- **Checkout on WhatsApp** on `/cart` builds a structured message (lines, prices, URLs, subtotal, note placeholder) and opens `wa.me`. **PostHog** event `cart_whatsapp_checkout_clicked` and optional **`/api/order-intent`** logging do not block the user.

## Admin system overview

- **Login:** `/admin/login` — HMAC-signed **httpOnly** cookie session (`lib/admin-auth.ts`) or Supabase-backed email flow when configured.
- **Pages:** order intent inbox, export, orders list and detail, communications / retries visibility, audit log.
- **Audit:** mutating actions should write to `admin_audit_logs` where implemented.

## Cron / retry overview

- **Vercel Cron** hits `/api/cron/communications-retries` with `Authorization: Bearer CRON_SECRET`.
- **Processor:** `processDueCommunicationRetries` (`lib/order-communication-retries.ts`) re-attempts failed `order_communications` rows subject to `max_retries` / `next_retry_at`.
- **Customer notifications:** `lib/order-communications.ts` — Twilio SMS/WhatsApp, generic webhook, or simulated path depending on env.

## Build, lint, and tests

| Command | Purpose |
|---------|---------|
| `npm run dev` | Development server |
| `npm run build` | Production build (includes catalog validation) |
| `npm run start` | Serve production build locally |
| `npm run lint` | ESLint |
| `npm run validate:catalog` | Catalog JSON validation only |
| `npm run smoke:*` | API smoke scripts (see `scripts/smoke-hardening.ts`) |

There is no Jest/Vitest suite in-repo; rely on **build**, **lint**, **smoke scripts**, and manual QA for releases.

## Production notes

- **Payments:** Confirmed manually on WhatsApp / offline—no card gateway in this codebase.
- **Inventory:** Enforced in UI from catalog; cart clamps quantities to `inventoryQty`.
- **SEO:** `/cart` uses `noindex`; sitemap lists public routes and products, not the cart page.
- **Runbook:** Operational checklist, Twilio, Resend, and rollback notes live in **`RUNBOOK.md`**.
- **Proxy:** Apex → www 301 redirect lives in `proxy.ts` (Next.js 16 `proxy` file convention; replaces the legacy `middleware` file).

## Further reading

- **`AI_CONTEXT.md`** — condensed context for AI assistants (architecture, flows, do-not-redesign list).
- **`PROJECT_STATUS.md`** — readiness, gaps, roadmap suggestions.
- **`RUNBOOK.md`** — operator runbook and env checklist.
- **`AGENTS.md`** — Next.js version note for agents.
