-- supabase/migrations/00110_platform_fee_charges.sql
-- The fee actually calculated for a payment. The effective rate and amounts
-- are snapshotted so future policy changes cannot rewrite financial history.

create table public.platform_fee_charges (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  wallet_account_id uuid not null references public.wallet_accounts (id),
  payment_id uuid not null references public.payments (id),
  fee_rule_id uuid not null references public.platform_fee_rules (id),
  currency_code text not null default 'USD',
  payment_amount numeric(18, 4) not null,
  percentage_rate numeric(7, 4) not null,
  percentage_fee_amount numeric(18, 4) not null,
  minimum_fee_amount numeric(18, 4) not null default 0,
  fixed_fee_amount numeric(18, 4) not null default 0,
  charged_fee_amount numeric(18, 4) not null,
  status wallet_transaction_status not null default 'pending',
  wallet_transaction_id uuid null references public.wallet_transactions (id),
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  posted_at timestamptz null,
  constraint platform_fee_charges_amounts_positive check (
    payment_amount > 0 and percentage_fee_amount >= 0 and minimum_fee_amount >= 0
    and fixed_fee_amount >= 0 and charged_fee_amount >= 0
  ),
  constraint platform_fee_charges_rate_valid check (percentage_rate between 0 and 100),
  constraint platform_fee_charges_idempotency_not_blank check (length(btrim(idempotency_key)) > 0),
  constraint platform_fee_charges_posted_at_valid check (
    (status = 'posted' and posted_at is not null) or status <> 'posted'
  )
);

create unique index platform_fee_charges_payment_key
  on public.platform_fee_charges (payment_id);
create unique index platform_fee_charges_idempotency_key
  on public.platform_fee_charges (company_id, idempotency_key);
create index platform_fee_charges_company_status_idx
  on public.platform_fee_charges (company_id, status, created_at desc);

comment on table public.platform_fee_charges is
  'A payment-specific, immutable snapshot of the platform fee charged under one fee rule.';
