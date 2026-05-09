# AI context — Little Smiles

**Purpose:** Onboarding for future AI assistants (Cursor, Claude, GPT, etc.) working in this repository. Reflects the **current** codebase. **Do not paste secrets** into chats or docs.

---

## Project purpose

**Little Smiles** is a premium **baby boutique** website for **Pakistan**: product discovery, trust content (blog, policies, reviews), and **WhatsApp-mediated purchasing**. The business model is **consultative checkout** (chat confirmation, payment details on WhatsApp), not automated card capture.

---

## Brand direction and visual style

- **Aesthetic:** Soft, premium “editorial ecommerce” — warm neutrals (`#F9F5F1`, `#FCF8F4`, `#2F2624` accents), rounded cards (`rounded-3xl`), subtle grain/backdrop blur, **Cormorant Garamond** + **Plus Jakarta Sans** (see `app/layout.tsx`).
- **Tone:** Reassuring, parent-focused; delivery and returns clarity; WhatsApp as human touchpoint.
- **Do not unnecessarily** flatten the site into generic SaaS UI or strip motion/accessibility patterns without explicit user request.

---

## Core ecommerce philosophy

1. **Cart is the primary selection UX** — users add from grids, PDP, related products; **WhatsApp remains the checkout** (prefilled message).
2. **Catalog is authoritative** — `data/catalog.json` + `data/site.json`; build fails if catalog invalid.
3. **Stock and price** come from catalog at runtime; cart stores **`productSlug` + `quantity`** only.
4. **No payment gateway** in-app; do not add Stripe/etc. unless the product owner explicitly changes scope.

---

## Stack and architecture

| Layer | Notes |
|-------|--------|
| **Next.js 16** App Router | Server components by default; `"use client"` for cart, navbar, analytics |
| **React 19** | |
| **Tailwind 4** + **cva** | `components/ui/*` |
| **Supabase** | Server routes + admin use **service role** via `lib/supabase-admin.ts` |
| **Vercel** | Hosting; `vercel.json` cron |
| **PostHog** | `lib/posthog-client.ts`, lazy init |
| **Sentry** | `next.config.ts` wrap, `sentry.*.config.ts` |

**Catalog pipeline:** `lib/catalog-config.ts` reads JSON → `lib/products.ts` builds `Product[]`, helpers (`getProductBySlug`, `clampOrderQuantity`, `formatPkr`, WhatsApp message builders).

---

## Important routes / pages

**Public**

- `/` — Home
- `/shop`, `/shop/[slug]` — Listing + PDP
- `/cart` — Cart (**noindex** metadata)
- `/blog`, `/blog/[slug]`
- `/best-sellers`, `/reviews`, `/contact`, `/track-order`
- Policy pages: `/shipping-policy`, `/return-refund-policy`, `/privacy-policy`, `/terms`

**API (representative)**

- `POST /api/order-intent` — intent logging (optional Supabase)
- `POST /api/contact` — Resend email
- `POST /api/track-order` — order lookup by phone + ref
- `POST /api/events/whatsapp-order` — server-side WhatsApp click logging
- `GET /api/cron/communications-retries` — **Bearer `CRON_SECRET`**
- `/api/admin/*` — authenticated admin JSON

**Admin** (cookie session)

- `/admin/login`, `/admin/order-intents`, `/admin/orders`, `/admin/orders/[orderId]`, `/admin/notifications`, `/admin/audit`

---

## Important backend systems

- **Runtime env validation:** `lib/runtime-env.ts` + `instrumentation.ts` (`assertRuntimeEnvAtStartup` on Node runtime).
- **Rate limiting:** e.g. `lib/request-rate-limit.ts` on public APIs.
- **Order communications:** `lib/order-communications.ts` (Twilio / webhook / simulated).
- **Retries:** `lib/order-communication-retries.ts` + cron route.
- **Error capture:** `lib/error-observability.ts` / Sentry helpers.

---

## Order lifecycle flow (high level)

1. **Discovery:** User browses site; may generate **order intents** (`/api/order-intent`) on WhatsApp clicks or cart checkout (non-blocking).
2. **Fulfillment chat:** Staff confirm on WhatsApp; operational data entry happens in **admin** (orders created/updated in Supabase).
3. **Statuses:** `orders.status` — `new_intent` → `contacted` → `confirmed` → `dispatched` → `delivered` (or `cancelled`). History in `order_status_history`.
4. **Customer notifications:** On certain transitions, `order_communications` rows are created; delivery may be SMS/WhatsApp via Twilio or webhook; failures schedule retries processed by cron.

*This is **not** a self-service “place order and pay online” loop without human confirmation.*

---

## Cart system behavior

- **Key:** `little-smiles-cart-v1` (`lib/cart-storage.ts`).
- **Stored shape:** `{ productSlug, quantity }[]`.
- **Provider:** `components/cart-provider.tsx` — merge, sanitize against `getProductBySlug`, clamp qty, drop OOS/missing SKUs; persist on change; re-sanitize on `visibilitychange`.
- **UI:** `AddToCartButton`, `CartToast`, `/cart` via `components/cart-page-client.tsx`.
- **Hydration:** `isCartReady` avoids badge flash before `localStorage` read.

---

## WhatsApp checkout behavior

- **Single product:** `lib/products.ts` — `getWhatsappOrderLink`, `buildWhatsappOrderMessage` (PDP with qty/notes), listing inquiry template without fields.
- **Cart:** `lib/cart-checkout.ts` — `buildCartWhatsappCheckoutMessage`, `getCartWhatsappCheckoutUrl`.
- **Tracking:** `trackAndOpenWhatsapp` (`lib/order-intent-client.ts`) — prevents default navigation, fires PostHog `whatsapp_order_clicked`, `logOrderIntent`, races ~180ms, `window.open`.
- **Cart checkout:** `trackCartCheckoutAndOpenWhatsapp` — PostHog `cart_whatsapp_checkout_clicked` + intent payload without requiring `productSlug`.

---

## Supabase tables overview

**Documented in repo**

- `customers`, `orders`, `order_status_history`, `order_communications` — `supabase/orders-schema.sql`
- `admin_audit_logs` — `supabase/admin-audit-schema.sql`

**Used in application types** (`lib/supabase-admin.ts`)

- `order_intents` — columns include `product_slug`, `product_name`, `category`, `price_pkr`, `source_page`, `event_timestamp`, `user_agent`, `created_at`

**Gap:** `CREATE TABLE` for `order_intents` is **not** in the SQL files here; production DB must already have it (FK from `orders.source_intents_id`). Treat migrations holistically with `RUNBOOK.md`.

---

## Admin / auth architecture

- **Modes:** `ADMIN_AUTH_MODE` — `secret` (default) or `supabase`.
- **Secret mode:** `ADMIN_SECRET` signs HMAC session token in httpOnly cookie (`lib/admin-auth.ts`); login posts to `/api/admin/auth/login`.
- **Supabase mode:** `SUPABASE_ANON_KEY`, `ADMIN_ALLOWED_EMAILS`, email/password flow; still sets admin session pattern per `lib/admin-identity.ts` / login route.
- **Authorization:** Admin API routes verify session before mutating data.
- **Audit:** `admin_audit_logs` for sensitive actions (export, logins, etc.) where implemented.

---

## Analytics / event tracking

- **PostHog:** lazy-loaded client; `capturePostHogEvent` used for WhatsApp and cart checkout events.
- **GA:** `NEXT_PUBLIC_GA_ID` — `components/google-analytics.tsx`.
- **Server:** `POST /api/events/whatsapp-order` receives a subset of fields for optional webhook/logging when `whatsapp_order_clicked` is captured (see `lib/posthog-client.ts`).

---

## Retry / cron communication system

- **Schedule:** `vercel.json` — `GET /api/cron/communications-retries` at `0 12 * * *` (daily).
- **Auth:** Header `Authorization: Bearer CRON_SECRET`.
- **Logic:** `processDueCommunicationRetries` finds failed communications due for retry, respects `max_retries` / backoff (`lib/order-communications.ts` `computeNextRetryAtIso`).
- **Admin visibility:** `/admin/notifications` surfaces communication state for operators.

---

## Key design decisions (why)

| Decision | Rationale |
|----------|-----------|
| WhatsApp checkout | Market fit, trust, COD/bank coordination in PK |
| localStorage cart | Fast MVP, no accounts; avoids server session complexity |
| JSON catalog | Git-reviewable products; build-time validation |
| Service role server-only | Simple admin + APIs; RLS not the primary story in this codebase |
| Non-blocking intents | Never lose a sale because analytics/DB hiccupped |
| Cron on Vercel | No separate worker process for retry sweeps |

---

## Areas that should NOT be unnecessarily redesigned

- Overall **visual language** (warm neutrals, rounded cards, premium typography)
- **WhatsApp as final checkout** (can add channels, don’t remove without product sign-off)
- **Catalog-as-source-of-truth** pattern for storefront data
- **Admin flows** without a security/UX review (session cookies, service role)

---

## Current priorities (engineering)

1. Keep **build green** (`npm run build` + `validate:catalog`).
2. Preserve **cart + WhatsApp** parity on new product surfaces.
3. Any new **Supabase** writes: align types in `lib/supabase-admin.ts` and document schema.
4. Respect **RUNBOOK.md** for production operations.

---

## Future planned upgrades (suggestions only)

- Full SQL migrations in-repo (including `order_intents`)
- E2E tests for cart and checkout URLs
- Stronger distributed rate limiting if traffic grows
- Optional customer-facing order status without full auth

---

## Guidance for future AI audits / refactors

- Read **`RUNBOOK.md`**, **`lib/runtime-env.ts`**, and **`AI_CONTEXT.md`** before large changes.
- Prefer **small diffs**; this codebase values **polish over rewrites**.
- After schema changes, update **types**, **RUNBOOK**, and **PROJECT_STATUS**.
- Never commit **service role keys**, **admin secrets**, or **CRON** tokens.
- **Next.js:** This repo targets **Next 16**; check `node_modules/next/dist/docs` for breaking APIs per `AGENTS.md`.
