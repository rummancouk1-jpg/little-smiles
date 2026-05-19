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
4. Run `supabase/contentops-topics-schema.sql`
5. Run `supabase/contentops-notifications-schema.sql`
6. Confirm new/altered tables exist:
   - `order_intents`
   - `orders`
   - `order_status_history`
   - `customers`
   - `order_communications`
   - `admin_audit_logs`
   - `contentops_drafts`
   - `contentops_topics`
   - `contentops_notification_preferences`
7. Verify indexes are present for:
   - order intent recency and product grouping
   - order status filters
   - communication retry scheduling
   - audit log timeline/action filtering
   - contentops draft status/created ordering and slug-active uniqueness
   - contentops topic title uniqueness, status/priority filter, seasonality lookup, draft_id reverse-link

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

## ContentOps In-app Draft Generation

The operator can also generate drafts directly from the admin UI at `/admin/contentops/new`. The form posts to `POST /api/admin/contentops/drafts/generate` which calls the same `generateDraftFromTopic` helper the CLI uses.

**Runtime env requirement:** `ANTHROPIC_API_KEY` must be set in the Vercel project's runtime environment (Production + Preview, optionally Development). Without it, generation returns 500 with a clear "API key not configured" message; the rest of ContentOps continues to function.

**Vercel function timeout:** the route declares `maxDuration = 60`. Sonnet typically writes a full article in 15–30 seconds. On Vercel Hobby the function-level cap may still be 10 seconds depending on plan settings — if generation times out, the draft may have been created server-side; refresh the editorial queue to confirm before retrying.

**Audit:** every in-app generation writes a `contentops_draft_generated` row to `admin_audit_logs` with the topic, slug, and title metadata. CLI-driven generations do not write this audit row.

**Cost:** each generation spends ~$0.05–$0.10 in Anthropic tokens. The form's pending state disables the button to prevent rapid-fire submissions. If abuse becomes a concern, add server-side rate limiting per session.

## ContentOps Topic Queue (Editorial Planning)

The topic queue is the editorial planning layer. Each row represents a topic the operator wants to (eventually) publish about. Topics live at `/admin/contentops/topics` and feed directly into draft generation — clicking "Generate draft" on a topic card runs the same Anthropic pipeline as the freeform Create-draft surface, then links the resulting draft back to the topic so the queue reflects operational state.

**State machine:**
- `queued` → `drafted` (automatic when a draft is generated from the topic)
- `drafted` → `published` (automatic when the linked draft is published, via the publish API and the cron sweep)
- `queued` or `drafted` → `archived` (explicit operator action)

**One-time setup:** apply `supabase/contentops-topics-schema.sql` (idempotent). The migration creates the `contentops_topics` table, indexes, and seeds seven starter topics covering swaddles, newborn care, baby sleep, summer clothing, feeding routines, diaper bags, and Eid gifting.

**Operator paths:**
- View queue: `/admin/contentops/topics` (default filter: queued)
- Add a topic: `+ Add topic` button → `/admin/contentops/topics/new`
- Generate draft from topic: card-level **Generate draft** action (15-30 second wait, redirects to the new draft's review page)
- Lower priority: card-level link (only shown when not already low)
- Archive: card-level link with inline confirmation

**Audit:** every state-changing action writes a row to `admin_audit_logs`:
- `contentops_topic_created`
- `contentops_topic_archived`
- `contentops_topic_priority_updated`
- `contentops_topic_draft_generated`

**Concurrency:** the queued→drafted transition uses a SQL-level guard so two operators can't double-generate from the same topic. A second concurrent attempt fails with "Topic is drafted, not queued."

### Editorial intelligence layer (Commit V)

Topics carry additional optional fields populated by seeds and (in the future) by auto-discovery:

- **content_angle** — calm editorial framing, italic on the card
- **suggested_cta** — preview of likely CTA copy
- **confidence_score** — 0..100 integer, range-checked at the DB
- **snoozed_until** — date the topic resurfaces from "save for later"

These are operator-visible but never operator-input via the create form. The topic card surfaces them when present and stays clean when absent.

The topic state machine gains one value:

- `snoozed` — paused via "Save for later". Returns to `queued` on "Bring back" or via explicit operator action.

**New operator actions:**

- **Save for later** (`POST /api/admin/contentops/topics/[id]/snooze`, body `{ days?: number }` defaulting to 30) — moves a queued topic to `snoozed` with `snoozed_until` set 30 days out.
- **Bring back** (`POST /api/admin/contentops/topics/[id]/unsnooze`) — returns a snoozed topic to `queued` and clears `snoozed_until`.
- **Mark seasonal priority** (`POST /api/admin/contentops/topics/[id]/seasonal-priority`) — composite action: sets priority to `high` and refreshes `suggested_window_start` / `suggested_window_end` to "now through 30 days from now". Doesn't change the topic's classified seasonality.

**New audit actions:** `contentops_topic_snoozed`, `contentops_topic_unsnoozed`, `contentops_topic_seasonal_priority`.

**Migration safety:** `supabase/contentops-topics-schema.sql` is fully idempotent. New columns are added with `IF NOT EXISTS`; the status `CHECK` constraint is dropped-and-recreated by name; seeded rows use `ON CONFLICT (title) DO UPDATE` to backfill the new intelligence fields without overwriting operator edits to other columns.

## ContentOps Notifications + Daily Digest

The notification engine sits at `lib/contentops/notifications/`. Channel-agnostic types + a channel-adapter interface let future providers (WhatsApp, alternate email backends) plug in without changing the cron, composer, or settings UI.

**Current channel:** email via Resend.

**One-time setup:**
1. Apply `supabase/contentops-notifications-schema.sql` (idempotent). Seeds the singleton preferences row.
2. Set runtime env vars:
   - `RESEND_API_KEY` (required for any send)
   - `CONTENTOPS_DIGEST_FROM_EMAIL` (optional; falls back to `CONTACT_FROM_EMAIL`)
   - `CRON_SECRET` (already used by other crons)
3. Open `/admin/contentops/settings/notifications`. Set a recipient email, save, then enable the digest toggle.

**Daily cron:**
- Route: `/api/cron/contentops-daily-digest`
- Schedule (in `vercel.json`): `30 3 * * *` UTC → **08:30 PKT** morning brief
- Auth: `CRON_SECRET` Bearer
- Manual trigger: `curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/contentops-daily-digest`

**Quiet skips (no error, just exits):**
- `digest_enabled = false` → skipped reason: `digest_disabled`
- `digest_recipient_email = null` → `no_recipient`
- Email channel not configured → `email_channel_not_configured`
- `skip_empty_digests = true` AND state is genuinely empty → `empty_state`

**Manual test send:** the settings page has a "Send a test digest" button that POSTs to `/api/admin/contentops/notifications/send-digest`. Bypasses the `skip_empty_digests` filter so the operator can see the calm-day version too.

**What the digest contains (in order, sections omitted if empty):**
1. Awaiting your review (pending drafts)
2. Approved drafts ready to publish
3. Scheduled this week (next 7 days)
4. Recently live (last 7 days, informational)
5. Heads up (low topic queue, missing hero images, cadence gaps)

**Vercel tier:** this is the third cron in `vercel.json`. Hobby tier caps free cron count; Pro removes the cap. If you're on Hobby and over the limit, disable the digest cron or upgrade.

**Audit:**
- `contentops_notification_prefs_updated` — settings page saves
- `contentops_digest_sent_manual` — operator-triggered test sends
- Daily cron sends are not audited (system path, not admin action) — Sentry telemetry covers them via `captureServerError` on failure.

**Future channels:** the `NotificationChannelAdapter` interface accepts any provider. WhatsApp will land as a new file at `lib/contentops/notifications/channels/whatsapp.ts` implementing the same shape. The cron and settings page won't need restructuring.

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

## ContentOps Edit-in-Place (Commit X)

The operator can refine any non-published draft directly from the admin without regenerating the article. The edit page lives at `/admin/contentops/<id>/edit` and accepts any subset of: title, description, category, related category, publish date, read time, keywords, sections (add/remove/reorder), CTA label, CTA href. Slug is intentionally locked — changing it would break URL semantics.

**Workflow:**
1. From the article-review page, click **Edit article**.
2. Refine fields. Sections accept blank-line-separated paragraphs.
3. Click **Save changes**. The form PATCHes `/api/admin/contentops/drafts/<id>` and returns to the article-review page on success.

**Schema integrity:** the engine merges the partial into the current `content` and re-validates the merged whole against `blogPostSchema` before persisting. Any field that would break the schema returns a 400 with the offending issue surfaced to the form.

**Frozen state:** `status='published'` rejects all edits. To change a live article, generate a new draft.

**Image metadata:** alt text and caption on `hero`/`thumbnail` are editable inline from the media management page via PATCH `/api/admin/contentops/drafts/<id>/images/<slot>`. Replacing the image (uploading new bytes) still goes through the existing flow.

**Revision awareness:** two new columns on `contentops_drafts`:
- `manually_edited boolean default false`
- `last_edited_at timestamptz null`

Every successful edit sets both. The article-review page surfaces this as an **"AI draft"** pill (unedited) or **"Edited · 2h ago"** pill (operator-touched).

**Audit:** every save writes one of two rows to `admin_audit_logs`:
- `contentops_draft_edited` — content edits, with `changedFields` array
- `contentops_image_metadata_edited` — alt/caption edits

**Migration safety:** the column additions in `supabase/contentops-schema.sql` use `IF NOT EXISTS` and `DEFAULT false`. Re-running the migration on an older database backfills the columns without disturbing existing rows.

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

## ContentOps Media (Image Foundation)

Commit N adds image infrastructure to the ContentOps pipeline. Images travel with the draft's content JSONB as structured metadata; the binary blobs live in Supabase Storage. Static-seed posts (`lib/blog.ts`) have no images today and remain valid because every image field is optional.

### One-time Supabase Storage setup

The bucket must exist before image upload works. In the Supabase dashboard (Storage → Create bucket) or via SQL:

```sql
insert into storage.buckets (id, name, public)
values ('contentops-images', 'contentops-images', true)
on conflict (id) do update set public = excluded.public;

-- Public read policy so the rendered URLs resolve without auth.
-- Service role bypasses RLS, so no policy is needed for writes.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'contentops-images public read'
  ) then
    create policy "contentops-images public read"
      on storage.objects for select
      to public
      using (bucket_id = 'contentops-images');
  end if;
end $$;
```

Confirm:
- Bucket `contentops-images` exists and is **public**.
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set in the runtime env.

If the bucket is missing, the upload API returns 500 with "Storage upload failed. Is the bucket configured?" — fix by running the SQL above.

### Image workflow

1. **Upload:** operator POSTs `multipart/form-data` to `/api/admin/contentops/drafts/<id>/images/upload` with fields `file` (image/jpeg, image/png, or image/webp; ≤ 8 MB; 200×200 to 4000×4000) and `altText` (1–500 chars, required for accessibility). Response includes a `BlogImage` object with the public URL, dimensions, and an internal `storageKey`.
2. **Attach:** operator POSTs `{ image: <BlogImage> }` to `/api/admin/contentops/drafts/<id>/images/hero` or `.../thumbnail`. The image is written into the draft's `content` JSONB at the chosen slot.
3. **Remove:** operator DELETEs `.../images/<slot>`. The slot is cleared in the content; if the image carries a `storageKey`, its blob is also deleted from the bucket.

Slot support in Commit N: `hero` and `thumbnail`. Per-section images are schema-ready (the `section.image` field exists in `BlogPost`) but the API rejects `section:N` slots until a later commit wires the editorial workflow.

**Frozen drafts:** uploads and attaches are rejected for `status='published'` drafts. Live articles cannot have their images swapped through the admin API — a new draft must be created for any image change to a live post.

**Audit:** three new actions appear in `admin_audit_logs`:
- `contentops_image_uploaded` — blob arrived in the bucket.
- `contentops_image_attached` — slot association written into content.
- `contentops_image_removed` — slot cleared (and blob deleted if managed).

### Image format guidance

- **Hero:** ~1600×900 (16:9). WebP preferred for size; JPEG fallback acceptable.
- **Thumbnail:** ~800×600 or smaller. WebP preferred.
- **Aspect ratio:** the schema does not enforce a ratio, but heroes outside 16:9 / 4:3 may render awkwardly once the public layout adds hero rendering (Commit P).
- **Alt text:** required at upload time. Treat as the description a screen-reader user will hear; not a caption.

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
