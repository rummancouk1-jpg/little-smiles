-- Little Smiles — order_intents schema (lead capture for WhatsApp / COD checkout)
-- Idempotent and additive-only. Safe to re-run in the Supabase SQL editor.
--
-- Historically this table's DDL lived only in production — it was referenced as
-- an FK target by public.orders.source_intent_id but never checked in. This file
-- makes the base table canonical AND extends it to hold the full Cash-on-Delivery
-- payload captured the moment a customer taps "Confirm COD Order" on /cart, so a
-- filled-but-unsent order stays recoverable and fulfillable even if the WhatsApp
-- handoff never lands.
--
-- Run order: apply this in the Supabase SQL editor BEFORE deploying the capture
-- code. Until the new columns exist, the API degrades gracefully (the insert of
-- the extra fields is what would fail) — it never blocks the customer's checkout.

-- 1) Canonical base table — matches the columns the app has always written for
--    thin analytics intents (PDP / listing WhatsApp clicks). `if not exists`
--    makes this a no-op where the table already lives in production.
create table if not exists public.order_intents (
  id uuid primary key default gen_random_uuid(),
  product_slug text null,
  product_name text null,
  category text null,
  price_pkr integer null,
  source_page text not null,
  event_timestamp timestamptz not null,
  user_agent text null,
  created_at timestamptz not null default now()
);

-- 2) Additive: full COD customer + cart payload. Every column is nullable so the
--    existing thin analytics intents keep inserting unchanged; only the /cart COD
--    Confirm-tap populates them.
alter table public.order_intents add column if not exists customer_name text null;
alter table public.order_intents add column if not exists customer_phone text null;
alter table public.order_intents add column if not exists customer_city text null;
alter table public.order_intents add column if not exists customer_address text null;
alter table public.order_intents add column if not exists items jsonb null;
alter table public.order_intents add column if not exists quantity integer null;
alter table public.order_intents add column if not exists total_pkr integer null;

-- 3) Review + lookup indexes for the admin order-intents surface (idempotent).
create index if not exists idx_order_intents_created_at
  on public.order_intents(created_at desc);
create index if not exists idx_order_intents_customer_phone
  on public.order_intents(customer_phone)
  where customer_phone is not null;
