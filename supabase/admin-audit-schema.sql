-- Little Smiles admin audit log schema
-- Run in Supabase SQL editor (safe to re-run)

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_label text not null,
  action text not null,
  target_type text null,
  target_id text null,
  ip_address text null,
  user_agent text null,
  metadata jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_audit_logs_created_at
  on public.admin_audit_logs(created_at desc);

create index if not exists idx_admin_audit_logs_action
  on public.admin_audit_logs(action, created_at desc);
