-- supabase/migrations/00106_wallet_accounts.sql
-- One virtual wallet balance per company and currency. Ledger entries in
-- wallet_transactions remain the authoritative financial history.

create table public.wallet_accounts (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  currency_code text not null default 'USD',
  available_balance numeric(18, 4) not null default 0,
  held_balance numeric(18, 4) not null default 0,
  pending_balance numeric(18, 4) not null default 0,
  version bigint not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint wallet_accounts_available_non_negative check (available_balance >= 0),
  constraint wallet_accounts_held_non_negative check (held_balance >= 0),
  constraint wallet_accounts_pending_non_negative check (pending_balance >= 0),
  constraint wallet_accounts_version_non_negative check (version >= 0)
);

create unique index wallet_accounts_company_currency_key
  on public.wallet_accounts (company_id, currency_code)
  where deleted_at is null;
create index wallet_accounts_company_active_idx
  on public.wallet_accounts (company_id, is_active)
  where deleted_at is null;

comment on table public.wallet_accounts is
  'A virtual company wallet balance. Updates must use a row lock and increment version in transactional application code.';
