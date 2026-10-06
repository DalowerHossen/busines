-- supabase/migrations/00107_payment_holds.sql
-- Funds collected through Merchant of Record are held before becoming
-- available for payout. Release is performed by scheduled, idempotent work.

create table public.payment_holds (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  wallet_account_id uuid not null references public.wallet_accounts (id),
  payment_id uuid not null references public.payments (id),
  status payment_hold_status not null default 'held',
  currency_code text not null default 'USD',
  held_amount numeric(18, 4) not null,
  released_amount numeric(18, 4) not null default 0,
  hold_until timestamptz not null,
  released_at timestamptz null,
  release_reference text null,
  reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint payment_holds_held_amount_positive check (held_amount > 0),
  constraint payment_holds_released_amount_valid check (
    released_amount >= 0 and released_amount <= held_amount
  ),
  constraint payment_holds_release_fields_valid check (
    (status in ('released', 'partially_released') and released_at is not null)
    or status in ('held', 'cancelled')
  )
);

create unique index payment_holds_payment_id_key
  on public.payment_holds (payment_id)
  where deleted_at is null;
create index payment_holds_release_queue_idx
  on public.payment_holds (hold_until, company_id)
  where status in ('held', 'partially_released') and deleted_at is null;
create index payment_holds_company_status_idx
  on public.payment_holds (company_id, status)
  where deleted_at is null;

comment on table public.payment_holds is
  'A configurable settlement hold against one Merchant of Record payment.';
