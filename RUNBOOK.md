# Little Smiles Production Runbook

## Required Environment Variables

### Core Runtime (required)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_SECRET` (if `ADMIN_AUTH_MODE=secret`)
- `CRON_SECRET`

### Contact + Marketing
- `RESEND_API_KEY`
- `CONTACT_TO_EMAIL` (expected: `littlesmiles.co.uk@gmail.com`)
- `CONTACT_FROM_EMAIL`
- `NEXT_PUBLIC_GA_ID` (format: `G-XXXXXXXXXX`)

### Admin Auth (optional, if using Supabase admin auth mode)
- `ADMIN_AUTH_MODE` (`secret` or `supabase`)
- `SUPABASE_ANON_KEY`
- `ADMIN_ALLOWED_EMAILS`
- `ADMIN_DEFAULT_LABEL`

### Notifications (optional provider-specific)
- `ORDER_NOTIFICATION_PROVIDER` (`twilio`, `webhook`, or fallback simulation)
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_SMS_FROM`
- `TWILIO_WHATSAPP_FROM`
- `ORDER_NOTIFICATION_WEBHOOK_URL`
- `ORDER_COMMUNICATION_MAX_RETRIES`

### Observability
- `SENTRY_DSN` and/or `NEXT_PUBLIC_SENTRY_DSN`
- `SENTRY_ORG` + `SENTRY_PROJECT` (for source map upload in CI/build)

### ContentOps Draft CLI (local-only)
- `ANTHROPIC_API_KEY` — required only when running `npm run contentops:draft`. Not used by the deployed server; do not set in Vercel production.

## Supabase Migration Order

1. Run `supabase/orders-schema.sql`
2. Run `supabase/admin-audit-schema.sql`
3. Run `supabase/contentops-schema.sql`
4. Confirm new/altered tables exist:
   - `order_intents`
   - `orders`
   - `order_status_history`
   - `customers`
   - `order_communications`
   - `admin_audit_logs`
   - `contentops_drafts`
5. Verify indexes are present for:
   - order intent recency and product grouping
   - order status filters
   - communication retry scheduling
   - audit log timeline/action filtering
   - contentops draft status/created ordering and slug-active uniqueness

## Resend Setup

1. Create/verify Resend account and sending domain.
2. Add `RESEND_API_KEY` in Vercel project env vars.
3. Set `CONTACT_TO_EMAIL=littlesmiles.co.uk@gmail.com`.
4. Set `CONTACT_FROM_EMAIL` to a verified sender.
5. Submit test inquiry from `/contact`.
6. Confirm:
   - API returns success JSON.
   - email arrives at destination mailbox.
   - fallback message appears if delivery fails.

## Twilio Setup

1. Configure Twilio account credentials and sender IDs.
2. Add environment variables:
   - `ORDER_NOTIFICATION_PROVIDER=twilio`
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - at least one sender: `TWILIO_SMS_FROM` or `TWILIO_WHATSAPP_FROM`
3. Send a test communication from `/admin/orders/[id]`.
4. Validate on `/admin/notifications`:
   - status transitions (`queued` -> `sent` / `failed`)
   - provider response details are stored safely.

## Cron Validation

1. Ensure `vercel.json` includes `/api/cron/communications-retries` schedule.
2. Set `CRON_SECRET` in Vercel.
3. Manually hit cron endpoint with authorization:
   - `Authorization: Bearer <CRON_SECRET>`
4. Verify:
   - response contains retry summary.
   - `/admin/notifications` "Last cron run" card updates.
   - status badge is `healthy` after recent execution.

## Admin Login Flow

1. Navigate to `/admin/login`.
2. Authenticate using:
   - secret mode: password only (`ADMIN_SECRET`)
   - supabase mode: email + password
3. Confirm secure cookie is set (`httpOnly`, `sameSite=lax`).
4. Access private admin pages:
   - `/admin/order-intents`
   - `/admin/orders`
   - `/admin/notifications`
   - `/admin/audit`
5. Verify audit logs include login/logout and admin actions.

## Smoke Tests

Set once:
- `SMOKE_BASE_URL` (default `http://localhost:3000`)
- `SMOKE_ADMIN_PASSWORD` (required for admin API smoke tests)
- `SMOKE_ADMIN_EMAIL` (only for Supabase auth mode)
- `SMOKE_CUSTOMER_PHONE` (optional)

Run:
- `npm run smoke:order-intent`
- `npm run smoke:create-order-from-intent`
- `npm run smoke:order-status-update`
- `npm run smoke:communication-retry`
- `npm run smoke:track-order`

## ContentOps Draft CLI

Generates one AI blog draft locally and persists it to `contentops_drafts` for human review. Local-only — never runs on Vercel.

**Prerequisites:**
1. `supabase/contentops-schema.sql` has been applied to the target Supabase database.
2. `ANTHROPIC_API_KEY` is set in the local environment.
3. `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` point to the same database that received the migration.

**Run:**

```
npm run contentops:draft -- "<topic>"
```

**Behavior:**
- Validates env vars and pings Supabase before any Anthropic call (fails fast on misconfiguration).
- Generates one `BlogPost` via Sonnet using tool-use forcing.
- Validates the model's output against the Zod `blogPostSchema`; never inserts invalid data.
- Checks for an active duplicate slug (`pending_review` or `approved`) before inserting.
- Inserts with `status='pending_review'`. Never auto-publishes.

**Exit codes:** `0` on successful insert. `1` on any failure (env, network, validation, duplicate, insert error). Failure modes print the validated or raw draft to stderr where useful for recovery.

## ContentOps Publish Loop

The reviewer approves a draft in the admin, then prepares its publish bundle, then ships it. The system never auto-publishes — a human pastes the diff into `lib/blog.ts`, commits, and deploys via Vercel before marking the draft `published`.

**Workflow:**
1. Reviewer opens `/admin/contentops/<id>` and clicks **Approve** (or **Reject** with optional note).
2. After approval, reviewer clicks **Prepare publish** to open the diff/conflict report.
3. After fixing any `error` conflicts (warnings are advisory), the reviewer clicks **Copy to clipboard**.
4. Operator pastes the diff before the closing `]` of `rawBlogPosts` in `lib/blog.ts`, commits, pushes, and waits for the Vercel deploy.
5. With the deploy live, operator returns to the prepare-publish page and clicks **Mark as published** (Step 2). An optional `publish_notes` field can record the deploy SHA or PR link.

**Audit:** approve, reject, and publish each write an `admin_audit_logs` row tagged `contentops_draft_<action>` with the draft's slug.

**Schema requirement:** `contentops_drafts` must have the `publish_notes text null` column. The migration in `supabase/contentops-schema.sql` is idempotent; re-running it on an older database adds the column safely.

## ContentOps Scheduled Publishing

Approved articles can be queued to go live at a future date/time. The operator picks a time from the publishing surface; a Vercel cron sweeps due rows and promotes them to `published` with on-demand revalidation.

**Workflow:**
1. Reviewer approves the draft (unchanged).
2. Operator opens `/admin/contentops/publishing/<id>`, clicks **Schedule publish**.
3. Picks a datetime (browser local timezone, must be ≥1 minute in the future).
4. Confirms. The draft moves to `status='scheduled'` with `scheduled_at` set; an audit row tagged `contentops_draft_scheduled` is written.
5. The `/api/cron/contentops-publish-due` cron runs every 15 minutes, lists rows whose `scheduled_at <= now()`, calls `markDraftPublished` per row, and triggers `revalidatePath` for `/blog`, `/blog/<slug>`, and `/`.
6. The article goes live within ~15 minutes of its scheduled time.

**Override paths:**
- **Publish now (override):** operator can publish a scheduled draft immediately. Same API as the regular Publish now flow; the engine's SQL-level guard accepts `scheduled → published` transitions.
- **Reschedule:** open the picker again on a scheduled draft and confirm a new time.
- **Cancel schedule:** flip back to `approved` and clear `scheduled_at`. Audit row tagged `contentops_draft_unscheduled`.

**Cron configuration:**
- `vercel.json` schedules `/api/cron/contentops-publish-due` every 15 minutes (`*/15 * * * *`).
- Auth via `CRON_SECRET` Bearer token (same token as `communications-retries`).
- Manual trigger for verification: `curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/contentops-publish-due`.

**Vercel tier note:** Hobby plan limits cron jobs to once per day. If you're on Hobby, change `*/15 * * * *` to `0 12 * * *` (or similar daily slot) — scheduling resolution becomes once-per-day. Pro plan supports the 15-minute cadence.

**Failure isolation:** the sweep processes drafts row-by-row inside a try/catch. One bad row never blocks the rest. Revalidation failures inside the sweep are logged via `captureServerError` but don't fail the publish — ISR (`revalidate=300`) is the safety net.

## Rollback Steps

1. Revert deployment to last stable build in Vercel.
2. Disable cron retries temporarily (remove cron schedule or block endpoint auth).
3. Switch `ORDER_NOTIFICATION_PROVIDER` to simulation fallback if provider instability is detected.
4. Keep admin access in `secret` mode if Supabase auth mode fails.
5. If migration introduced issues, roll back schema changes manually:
   - disable dependent APIs first
   - drop added columns/tables only after confirming data backup.

## Launch Checklist

- [ ] All required env vars are set in production.
- [ ] `npm run build` passes on main branch.
- [ ] Contact form delivery verified (Resend).
- [ ] WhatsApp intent tracking writes to Supabase.
- [ ] Admin login, order creation, status updates, and communications work.
- [ ] Retry processor works manually and via cron.
- [ ] Notifications monitor shows healthy cron status.
- [ ] Audit logs capture admin and export actions.
- [ ] Track-order lookup works with real order + phone.
- [ ] Sentry DSN configured and test error appears in Sentry dashboard.
