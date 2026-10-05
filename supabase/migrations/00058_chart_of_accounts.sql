-- supabase/migrations/00058_chart_of_accounts.sql
-- One account in a company's chart of accounts (P7.5), optionally nested
-- under a parent account for sub-account grouping. A country-based COA
-- template (AA3.6) is seeded per company in Phase 19; this migration only
-- creates the table shape.

create table public.chart_of_accounts (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  account_code text not null,
  account_name text not null,
  account_type account_type not null,
  parent_account_id uuid null references public.chart_of_accounts (id),
  is_active boolean not null default true,
  description text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create unique index chart_of_accounts_company_account_code_key
  on public.chart_of_accounts (company_id, account_code)
  where deleted_at is null;
create index chart_of_accounts_company_id_idx
  on public.chart_of_accounts (company_id)
  where deleted_at is null;
create index chart_of_accounts_parent_account_id_idx
  on public.chart_of_accounts (parent_account_id)
  where parent_account_id is not null;

comment on table public.chart_of_accounts is
  'A company''s chart of accounts (P7.5). A country-based starter template is seeded per company in Phase 19.';
