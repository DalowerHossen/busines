-- supabase/migrations/00063_bank_accounts.sql
-- A connected or manually-created bank account used for feed import and
-- reconciliation (EE6). account_number_masked only ever shows the last
-- few digits (e.g. "****1234"); the full account number is never stored.
-- `provider` is an internal identifier only (e.g. a future aggregator
-- codename) and must never be printed as a specific brand name in
-- public-facing UI copy, same rule as gateway_id.

create table public.bank_accounts (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  name text not null,
  account_number_masked text null,
  currency_code text not null default 'USD',
  provider text null,
  external_account_id text null,
  current_balance numeric(14, 2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create index bank_accounts_company_id_idx on public.bank_accounts (company_id) where deleted_at is null;

comment on table public.bank_accounts is
  'A connected or manually-created bank account (EE6.9 multi-account bank feed). Never stores a full account number, only a masked display value.';
