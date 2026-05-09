-- Little Smiles operational order workflow schema
-- Run in Supabase SQL editor (safe to re-run)

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  city text null,
  address_note text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_customers_phone_unique on public.customers(phone);
create index if not exists idx_customers_created_at on public.customers(created_at desc);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid null references public.customers(id) on delete set null,
  source_intent_id uuid null references public.order_intents(id) on delete set null,
  product_slug text not null,
  product_name text not null,
  category text not null,
  price_pkr integer not null check (price_pkr >= 0),
  quantity integer not null check (quantity > 0),
  status text not null check (
    status in ('new_intent', 'contacted', 'confirmed', 'dispatched', 'delivered', 'cancelled')
  ),
  customer_name text null,
  customer_phone text null,
  customer_city text null,
  address_note text null,
  delivery_fee_pkr integer not null default 0 check (delivery_fee_pkr >= 0),
  total_pkr integer not null default 0 check (total_pkr >= 0),
  courier text null,
  tracking_id text null,
  payment_method text null check (payment_method in ('cod', 'bank_transfer', 'easypaisa', 'jazzcash', 'other')),
  paid_status text not null default 'unpaid' check (paid_status in ('unpaid', 'partial', 'paid')),
  details_completed_at timestamptz null,
  source_page text null,
  intent_timestamp timestamptz null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_orders_updated_at on public.orders(updated_at desc);
create index if not exists idx_orders_product_slug on public.orders(product_slug);
create index if not exists idx_orders_customer_phone on public.orders(customer_phone);
create index if not exists idx_orders_payment_status on public.orders(paid_status, updated_at desc);
create index if not exists idx_orders_details_completed on public.orders(details_completed_at, created_at asc);

create table if not exists public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  from_status text null,
  to_status text not null check (
    to_status in ('new_intent', 'contacted', 'confirmed', 'dispatched', 'delivered', 'cancelled')
  ),
  note text null,
  changed_at timestamptz not null default now()
);

create index if not exists idx_order_status_history_order_id
  on public.order_status_history(order_id, changed_at desc);

create table if not exists public.order_communications (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  event_type text not null check (
    event_type in ('order_confirmed', 'order_dispatched', 'order_delivered', 'order_cancelled')
  ),
  channel text not null check (channel in ('whatsapp', 'sms')),
  recipient_phone text null,
  message_preview text null,
  delivery_status text not null check (delivery_status in ('queued', 'sent', 'failed')),
  provider_response jsonb null,
  idempotency_key text null,
  retry_count integer not null default 0 check (retry_count >= 0),
  max_retries integer not null default 2 check (max_retries >= 0),
  next_retry_at timestamptz null,
  last_error text null,
  sent_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists idx_order_communications_order_id
  on public.order_communications(order_id, created_at desc);
create unique index if not exists idx_order_communications_idempotency_key
  on public.order_communications(idempotency_key)
  where idempotency_key is not null;
create index if not exists idx_order_communications_retry_due
  on public.order_communications(delivery_status, next_retry_at asc)
  where delivery_status = 'failed';

alter table public.order_communications add column if not exists retry_count integer not null default 0 check (retry_count >= 0);
alter table public.order_communications add column if not exists max_retries integer not null default 2 check (max_retries >= 0);
alter table public.order_communications add column if not exists next_retry_at timestamptz null;
alter table public.order_communications add column if not exists last_error text null;

alter table public.orders add column if not exists customer_id uuid null references public.customers(id) on delete set null;
alter table public.orders add column if not exists customer_name text null;
alter table public.orders add column if not exists customer_phone text null;
alter table public.orders add column if not exists customer_city text null;
alter table public.orders add column if not exists address_note text null;
alter table public.orders add column if not exists delivery_fee_pkr integer not null default 0 check (delivery_fee_pkr >= 0);
alter table public.orders add column if not exists total_pkr integer not null default 0 check (total_pkr >= 0);
alter table public.orders add column if not exists courier text null;
alter table public.orders add column if not exists tracking_id text null;
alter table public.orders add column if not exists payment_method text null check (payment_method in ('cod', 'bank_transfer', 'easypaisa', 'jazzcash', 'other'));
alter table public.orders add column if not exists paid_status text not null default 'unpaid' check (paid_status in ('unpaid', 'partial', 'paid'));
alter table public.orders add column if not exists details_completed_at timestamptz null;

update public.orders
set total_pkr = greatest(0, coalesce(price_pkr, 0) * coalesce(quantity, 1) + coalesce(delivery_fee_pkr, 0))
where coalesce(total_pkr, 0) = 0;
