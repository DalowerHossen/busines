-- supabase/migrations/00161_tax_records.sql
-- Tax registrations, immutable transaction tax snapshots, and filing-period
-- summaries. These records make tax calculations reproducible after policy
-- changes and keep sales tax separate from income-information reporting.

create table public.company_tax_registrations (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  jurisdiction_code text not null,
  tax_type text not null default 'sales_use_tax',
  registration_status tax_registration_status not null default 'not_registered',
  registration_number_encrypted text null,
  account_last_four text null,
  collection_start_date date null,
  collection_end_date date null,
  effective_rule_id uuid null references public.tax_jurisdiction_rules (id),
  reviewed_by_user_id uuid null references public.users (id),
  reviewed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint company_tax_registrations_code_valid check (jurisdiction_code ~ '^[A-Z]{2}(-[A-Z0-9]{1,6})?$'),
  constraint company_tax_registrations_account_last_four_valid check (
    account_last_four is null or account_last_four ~ '^[0-9A-Za-z]{2,4}$'
  ),
  constraint company_tax_registrations_window_valid check (
    collection_end_date is null or collection_start_date is null or collection_end_date >= collection_start_date
  )
);

create unique index company_tax_registrations_current_key
  on public.company_tax_registrations (company_id, jurisdiction_code, tax_type)
  where deleted_at is null and registration_status in ('pending', 'active');
create index company_tax_registrations_company_idx
  on public.company_tax_registrations (company_id, registration_status)
  where deleted_at is null;

create table public.tax_transaction_records (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  payment_id uuid null references public.payments (id),
  payout_request_id uuid null references public.payout_requests (id),
  wallet_transaction_id uuid null references public.wallet_transactions (id),
  invoice_id uuid null references public.invoices (id),
  settlement_path settlement_path not null,
  tax_date date not null,
  buyer_country_code text not null,
  buyer_state_code text null,
  ship_to_address jsonb null,
  jurisdiction_code text null,
  taxability_code text null,
  taxable_amount numeric(18, 4) not null default 0,
  exempt_amount numeric(18, 4) not null default 0,
  tax_rate numeric(9, 6) not null default 0,
  tax_collected_amount numeric(18, 4) not null default 0,
  marketplace_facilitator_collected boolean not null default false,
  tax_engine_version text not null,
  source_snapshot jsonb not null default '{}'::jsonb,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  constraint tax_transaction_records_source_present check (
    payment_id is not null or payout_request_id is not null or wallet_transaction_id is not null or invoice_id is not null
  ),
  constraint tax_transaction_records_country_valid check (buyer_country_code ~ '^[A-Z]{2}$'),
  constraint tax_transaction_records_state_valid check (
    buyer_state_code is null or buyer_state_code ~ '^[A-Z]{2}$'
  ),
  constraint tax_transaction_records_amounts_non_negative check (
    taxable_amount >= 0 and exempt_amount >= 0 and tax_rate >= 0 and tax_collected_amount >= 0
  ),
  constraint tax_transaction_records_idempotency_not_blank check (length(btrim(idempotency_key)) > 0)
);

create unique index tax_transaction_records_idempotency_key
  on public.tax_transaction_records (company_id, idempotency_key);
create index tax_transaction_records_company_date_idx
  on public.tax_transaction_records (company_id, tax_date desc);
create index tax_transaction_records_jurisdiction_date_idx
  on public.tax_transaction_records (jurisdiction_code, tax_date desc)
  where jurisdiction_code is not null;

create table public.tax_return_periods (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  jurisdiction_code text not null,
  tax_type text not null default 'sales_use_tax',
  period_start date not null,
  period_end date not null,
  status tax_return_status not null default 'not_started',
  gross_sales_amount numeric(18, 4) not null default 0,
  taxable_sales_amount numeric(18, 4) not null default 0,
  exempt_sales_amount numeric(18, 4) not null default 0,
  tax_collected_amount numeric(18, 4) not null default 0,
  tax_remitted_amount numeric(18, 4) not null default 0,
  return_payload jsonb not null default '{}'::jsonb,
  filed_at timestamptz null,
  filed_by_user_id uuid null references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tax_return_periods_window_valid check (period_end >= period_start),
  constraint tax_return_periods_amounts_non_negative check (
    gross_sales_amount >= 0 and taxable_sales_amount >= 0 and exempt_sales_amount >= 0
    and tax_collected_amount >= 0 and tax_remitted_amount >= 0
  )
);

create unique index tax_return_periods_unique_key
  on public.tax_return_periods (company_id, jurisdiction_code, tax_type, period_start, period_end);

comment on table public.tax_transaction_records is
  'Immutable point-in-time tax calculation evidence. Never recalculate a historical row from current rules.';
