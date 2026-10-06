-- supabase/migrations/00108_wallet_transactions.sql
-- Append-only virtual-wallet ledger. Positive amount increases the wallet;
-- negative amount decreases it. Before/after balances make every posting
-- independently auditable.

create table public.wallet_transactions (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  wallet_account_id uuid not null references public.wallet_accounts (id),
  transaction_type wallet_transaction_type not null,
  status wallet_transaction_status not null default 'pending',
  currency_code text not null default 'USD',
  amount numeric(18, 4) not null,
  balance_before numeric(18, 4) not null,
  balance_after numeric(18, 4) not null,
  available_balance_before numeric(18, 4) not null,
  available_balance_after numeric(18, 4) not null,
  reference_type text null,
  reference_id uuid null,
  payment_hold_id uuid null references public.payment_holds (id),
  idempotency_key text null,
  description text null,
  posted_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint wallet_transactions_amount_non_zero check (
    amount <> 0 or transaction_type in ('hold_created', 'hold_released')
  ),
  constraint wallet_transactions_balances_non_negative check (
    balance_before >= 0 and balance_after >= 0
    and available_balance_before >= 0 and available_balance_after >= 0
  ),
  constraint wallet_transactions_balance_math check (
    balance_after = balance_before + amount
  ),
  constraint wallet_transactions_posted_at_valid check (
    (status = 'posted' and posted_at is not null) or status <> 'posted'
  )
);

create unique index wallet_transactions_idempotency_key
  on public.wallet_transactions (company_id, idempotency_key)
  where idempotency_key is not null;
create index wallet_transactions_account_idx
  on public.wallet_transactions (wallet_account_id, created_at desc);
create index wallet_transactions_company_type_idx
  on public.wallet_transactions (company_id, transaction_type, created_at desc);
create index wallet_transactions_hold_idx
  on public.wallet_transactions (payment_hold_id)
  where payment_hold_id is not null;

comment on table public.wallet_transactions is
  'An append-only virtual-wallet posting. Corrections use compensating entries rather than destructive edits.';
