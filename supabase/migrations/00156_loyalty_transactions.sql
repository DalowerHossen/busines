-- supabase/migrations/00156_loyalty_transactions.sql
-- Append-only points ledger with before/after balances.

create table public.loyalty_transactions (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  loyalty_account_id uuid not null references public.loyalty_accounts (id),
  transaction_type loyalty_transaction_type not null,
  points_delta numeric(18, 4) not null,
  balance_before numeric(18, 4) not null,
  balance_after numeric(18, 4) not null,
  reference_type text null,
  reference_id uuid null,
  description text null,
  created_by_user_id uuid null references public.users (id),
  created_at timestamptz not null default now(),
  constraint loyalty_transactions_delta_non_zero check (points_delta <> 0),
  constraint loyalty_transactions_balances_non_negative check (
    balance_before >= 0 and balance_after >= 0
  ),
  constraint loyalty_transactions_balance_math check (
    balance_after = balance_before + points_delta
  )
);

create unique index loyalty_transactions_reference_key
  on public.loyalty_transactions (loyalty_account_id, reference_type, reference_id)
  where reference_id is not null;
create index loyalty_transactions_account_time_idx
  on public.loyalty_transactions (loyalty_account_id, created_at desc);
create index loyalty_transactions_company_type_idx
  on public.loyalty_transactions (company_id, transaction_type, created_at desc);

comment on table public.loyalty_transactions is
  'Append-only client loyalty ledger; corrections use compensating points entries.';
