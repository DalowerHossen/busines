-- supabase/migrations/00058_create_payouts.sql
-- Payouts from a wallet to a real bank account or mobile wallet.
--
-- A payout is requested, reviewed, approved and only then sent. Every state
-- change is recorded, the money is reserved while the transfer is in flight,
-- and a failed or reversed transfer returns the amount to the wallet.

create table public.payout_accounts (
  id uuid primary key default public.generate_uuid_v7(),
  wallet_id uuid not null,
  company_id uuid,

  method public.payout_method not null default 'bank_transfer',
  label text not null,
  currency char(3) not null default 'USD',
  country_code char(2) not null default 'US',

  account_holder_name text not null,
  -- Account identifiers are encrypted; only the masked tail is kept in clear
  -- so the user can recognise the destination.
  account_details_encrypted text not null,
  account_mask text,
  bank_name text,

  is_default boolean not null default false,
  is_verified boolean not null default false,
  verified_at timestamptz,
  verification_reference text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint payout_accounts_label_check
    check (length(btrim(label)) between 1 and 80),
  constraint payout_accounts_holder_check
    check (length(btrim(account_holder_name)) between 2 and 160),
  constraint payout_accounts_currency_check
    check (currency ~ '^[A-Z]{3}$'),
  constraint payout_accounts_country_check
    check (country_code ~ '^[A-Z]{2}$')
);

comment on table public.payout_accounts is
  'Destinations a wallet balance can be paid out to, with encrypted details.';

create unique index payout_accounts_default_unique
  on public.payout_accounts (wallet_id)
  where is_default and deleted_at is null;

create index payout_accounts_wallet_idx
  on public.payout_accounts (wallet_id)
  where deleted_at is null;

-- -----------------------------------------------------------------------------
-- Payouts
-- -----------------------------------------------------------------------------

create table public.payouts (
  id uuid primary key default public.generate_uuid_v7(),
  wallet_id uuid not null,
  payout_account_id uuid,
  company_id uuid,

  payout_number text,
  status public.payout_status not null default 'requested',
  method public.payout_method not null default 'bank_transfer',

  amount numeric(18, 4) not null,
  currency char(3) not null,
  fee_amount numeric(18, 4) not null default 0,
  net_amount numeric(18, 4) generated always as (amount - fee_amount) stored,

  -- Set when the wallet currency differs from the destination currency.
  target_currency char(3),
  exchange_rate numeric(18, 8),
  target_amount numeric(18, 4),

  requested_at timestamptz not null default now(),
  requested_by uuid,
  reviewed_at timestamptz,
  reviewed_by uuid,
  approved_at timestamptz,
  approved_by uuid,
  processed_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  reversed_at timestamptz,

  provider_reference text,
  failure_reason text,
  rejection_reason text,
  statement_storage_key text,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint payouts_amount_check
    check (amount > 0 and fee_amount >= 0 and fee_amount < amount),
  constraint payouts_currency_check
    check (currency ~ '^[A-Z]{3}$'),
  constraint payouts_target_currency_check
    check (target_currency is null or target_currency ~ '^[A-Z]{3}$'),
  constraint payouts_exchange_check
    check (exchange_rate is null or exchange_rate > 0),
  constraint payouts_approval_check
    check (status <> 'approved' or approved_by is not null),
  constraint payouts_rejection_check
    check (status <> 'rejected' or rejection_reason is not null)
);

comment on table public.payouts is
  'Transfers of a wallet balance to a bank account or mobile wallet.';

create unique index payouts_number_unique
  on public.payouts (payout_number)
  where payout_number is not null;

create index payouts_wallet_idx
  on public.payouts (wallet_id, requested_at desc)
  where deleted_at is null;

create index payouts_status_idx
  on public.payouts (status, requested_at)
  where deleted_at is null;

create index payouts_company_idx
  on public.payouts (company_id, requested_at desc)
  where company_id is not null and deleted_at is null;

-- Requests a payout, reserving the amount so it cannot be spent twice.
create or replace function public.request_payout(
  p_wallet_id uuid,
  p_amount numeric,
  p_payout_account_id uuid default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_wallet public.wallets%rowtype;
  v_payout_id uuid;
begin
  select * into v_wallet from public.wallets where id = p_wallet_id for update;

  if not found then
    raise exception 'Wallet % was not found', p_wallet_id using errcode = 'P0002';
  end if;

  if v_wallet.is_frozen then
    raise exception 'This wallet is frozen and cannot pay out' using errcode = '42501';
  end if;

  if not v_wallet.is_payout_enabled then
    raise exception 'Payouts are disabled for this wallet' using errcode = '42501';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'A payout must be greater than zero' using errcode = '22023';
  end if;

  if p_amount < v_wallet.payout_threshold then
    raise exception 'The minimum payout for this wallet is %', v_wallet.payout_threshold
      using errcode = '22023';
  end if;

  if p_amount > v_wallet.available_balance then
    raise exception 'The available balance is % and cannot cover this payout',
      v_wallet.available_balance
      using errcode = '22023';
  end if;

  insert into public.payouts (
    wallet_id, payout_account_id, company_id, amount, currency, method,
    requested_by, status
  )
  values (
    p_wallet_id,
    coalesce(
      p_payout_account_id,
      (select id from public.payout_accounts
        where wallet_id = p_wallet_id and is_default and deleted_at is null)
    ),
    v_wallet.company_id,
    p_amount,
    v_wallet.currency,
    coalesce(
      (select method from public.payout_accounts
        where wallet_id = p_wallet_id and is_default and deleted_at is null),
      'bank_transfer'
    ),
    public.current_user_id(),
    'requested'
  )
  returning id into v_payout_id;

  -- The amount leaves the available balance immediately and is held in the
  -- reserved balance until the transfer completes or fails.
  perform public.post_wallet_transaction(
    p_wallet_id,
    'payout',
    -p_amount,
    'Payout requested',
    false,
    jsonb_build_object('payout_id', v_payout_id)
  );

  update public.wallets
     set reserved_balance = reserved_balance + p_amount,
         updated_at = now()
   where id = p_wallet_id;

  return v_payout_id;
end;
$$;

comment on function public.request_payout(uuid, numeric, uuid) is
  'Creates a payout request and reserves the amount in the wallet.';

-- Settles a payout once the provider confirms it, or returns the money.
create or replace function public.complete_payout(
  p_payout_id uuid,
  p_succeeded boolean,
  p_provider_reference text default null,
  p_failure_reason text default null
)
returns public.payout_status
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_payout public.payouts%rowtype;
  v_status public.payout_status;
begin
  select * into v_payout from public.payouts where id = p_payout_id for update;

  if not found then
    raise exception 'Payout % was not found', p_payout_id using errcode = 'P0002';
  end if;

  if v_payout.status in ('completed', 'failed', 'cancelled', 'rejected') then
    return v_payout.status;
  end if;

  update public.wallets
     set reserved_balance = greatest(reserved_balance - v_payout.amount, 0),
         last_payout_at = case when p_succeeded then now() else last_payout_at end,
         updated_at = now()
   where id = v_payout.wallet_id;

  if p_succeeded then
    v_status := 'completed';

    update public.payouts
       set status = v_status,
           provider_reference = coalesce(p_provider_reference, provider_reference),
           processed_at = coalesce(processed_at, now()),
           completed_at = now(),
           updated_at = now()
     where id = p_payout_id;
  else
    v_status := 'failed';

    update public.payouts
       set status = v_status,
           failure_reason = p_failure_reason,
           failed_at = now(),
           updated_at = now()
     where id = p_payout_id;

    -- The money goes back to the wallet so it can be paid out again.
    perform public.post_wallet_transaction(
      v_payout.wallet_id,
      'payout_reversal',
      v_payout.amount,
      coalesce(p_failure_reason, 'Payout failed and was returned'),
      false,
      jsonb_build_object('payout_id', p_payout_id)
    );
  end if;

  return v_status;
end;
$$;

comment on function public.complete_payout(uuid, boolean, text, text) is
  'Closes a payout as completed, or returns the reserved amount to the wallet.';
