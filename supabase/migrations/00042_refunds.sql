-- supabase/migrations/00042_refunds.sql
-- A full or partial refund issued against a payment. Currency is
-- inherited from the parent payment, not stored again here.

create table public.refunds (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  payment_id uuid not null references public.payments (id),
  status refund_status not null default 'pending',
  amount numeric(14, 2) not null,
  reason text null,
  initiated_by_user_id uuid not null references public.users (id),
  gateway_refund_id text null,
  processed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create index refunds_payment_id_idx on public.refunds (payment_id) where deleted_at is null;
create index refunds_company_id_idx on public.refunds (company_id) where deleted_at is null;
create index refunds_status_idx on public.refunds (company_id, status) where deleted_at is null;

comment on table public.refunds is
  'A full or partial refund against a payment. Supports V5.7 (fast refund tool) and the client credit-balance ledger (refund_issued reason).';
