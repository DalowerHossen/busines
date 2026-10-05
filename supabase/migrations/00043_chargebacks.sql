-- supabase/migrations/00043_chargebacks.sql
-- A chargeback/dispute against a payment, raised by the client's bank.
-- The evidence pack itself (consent, delivery proof, audit timeline) is
-- modeled by the dedicated V1-V4 tables added later in this migration
-- group; this table only tracks the chargeback's own lifecycle and
-- linkage, matching the lean Chargeback TS shape exactly.

create table public.chargebacks (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  payment_id uuid not null references public.payments (id),
  status chargeback_status not null default 'open',
  amount numeric(14, 2) not null,
  reason_code text not null,
  gateway_case_id text null,
  respond_by_date timestamptz null,
  resolved_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create index chargebacks_payment_id_idx on public.chargebacks (payment_id) where deleted_at is null;
create index chargebacks_company_id_idx on public.chargebacks (company_id) where deleted_at is null;
create index chargebacks_status_idx on public.chargebacks (company_id, status) where deleted_at is null;
create index chargebacks_respond_by_date_idx
  on public.chargebacks (respond_by_date)
  where status = 'open' and deleted_at is null;

comment on table public.chargebacks is
  'A chargeback/dispute against a payment. Powers the super_admin dispute center (V6.6) and the dispute-rate monitor computed in a later reporting phase (V6.3/V6.4).';
