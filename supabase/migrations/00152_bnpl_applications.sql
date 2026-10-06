-- supabase/migrations/00152_bnpl_applications.sql
-- Pluggable buy-now-pay-later application. Provider adapters are added in a
-- later core-library phase; this table stores eligibility and settlement
-- snapshots without card data.

create table public.bnpl_applications (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  client_id uuid not null references public.clients (id),
  invoice_id uuid null references public.invoices (id),
  payment_id uuid null references public.payments (id),
  provider_key text not null,
  status bnpl_application_status not null default 'pending',
  requested_amount numeric(18, 4) not null,
  approved_amount numeric(18, 4) null,
  provider_fee_amount numeric(18, 4) not null default 0,
  currency_code text not null default 'USD',
  external_application_id text null,
  eligibility_response jsonb null,
  risk_snapshot jsonb null,
  applied_at timestamptz not null default now(),
  approved_at timestamptz null,
  settled_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint bnpl_applications_provider_not_blank check (length(btrim(provider_key)) > 0),
  constraint bnpl_applications_requested_positive check (requested_amount > 0),
  constraint bnpl_applications_approved_valid check (
    approved_amount is null or (approved_amount > 0 and approved_amount <= requested_amount)
  ),
  constraint bnpl_applications_fee_non_negative check (provider_fee_amount >= 0),
  constraint bnpl_applications_eligibility_object check (
    eligibility_response is null or jsonb_typeof(eligibility_response) = 'object'
  ),
  constraint bnpl_applications_risk_object check (
    risk_snapshot is null or jsonb_typeof(risk_snapshot) = 'object'
  )
);

create unique index bnpl_applications_provider_id_key
  on public.bnpl_applications (provider_key, external_application_id)
  where external_application_id is not null and deleted_at is null;
create index bnpl_applications_company_status_idx
  on public.bnpl_applications (company_id, status, created_at desc)
  where deleted_at is null;
create index bnpl_applications_client_idx
  on public.bnpl_applications (client_id, created_at desc)
  where deleted_at is null;

comment on table public.bnpl_applications is
  'A tenant BNPL eligibility and financing application linked to a client invoice or payment.';
