-- supabase/migrations/00057_create_wallets.sql
-- Platform wallets.
--
-- When the platform acts as merchant of record it collects the money first and
-- owes the tenant the balance. The same ledger serves resellers, affiliates and
-- marketplace authors, so there is one place where every amount owed is held
-- and one place where every payout is drawn from.
--
-- The ledger is append only: a balance is never edited directly, it is the sum
-- of its entries, and the cached balance on the wallet is maintained by a
-- trigger so a reader never has to aggregate the whole history.

create table public.wallets (
  id uuid primary key default public.generate_uuid_v7(),

  -- Exactly one owner reference is set.
  company_id uuid,
  reseller_id uuid,
  user_id uuid,

  currency char(3) not null default 'USD',

  available_balance numeric(18, 4) not null default 0,
  pending_balance numeric(18, 4) not null default 0,
  reserved_balance numeric(18, 4) not null default 0,
  lifetime_credited numeric(18, 4) not null default 0,
  lifetime_debited numeric(18, 4) not null default 0,

  -- Payouts are only released above this amount, which keeps transfer costs
  -- sensible for small balances.
  payout_threshold numeric(18, 4) not null default 50,
  payout_hold_days smallint not null default 7,
  is_payout_enabled boolean not null default true,
  is_frozen boolean not null default false,
  frozen_reason text,

  last_payout_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint wallets_owner_check
    check (num_nonnulls(company_id, reseller_id, user_id) = 1),
  constraint wallets_currency_check
    check (currency ~ '^[A-Z]{3}$'),
  constraint wallets_balance_check
    check (available_balance >= 0 and pending_balance >= 0 and reserved_balance >= 0),
  constraint wallets_threshold_check
    check (payout_threshold >= 0 and payout_hold_days between 0 and 90),
  constraint wallets_frozen_check
    check (not is_frozen or frozen_reason is not null)
);

comment on table public.wallets is
  'Balance owed by the platform to a tenant, reseller or individual.';
comment on column public.wallets.pending_balance is
  'Money received but still inside the hold window before it can be paid out.';

create unique index wallets_company_unique
  on public.wallets (company_id, currency)
  where company_id is not null and deleted_at is null;

create unique index wallets_reseller_unique
  on public.wallets (reseller_id, currency)
  where reseller_id is not null and deleted_at is null;

create unique index wallets_user_unique
  on public.wallets (user_id, currency)
  where user_id is not null and deleted_at is null;

create index wallets_payable_idx
  on public.wallets (currency)
  where deleted_at is null and is_payout_enabled and not is_frozen;

-- -----------------------------------------------------------------------------
-- Ledger entries
-- -----------------------------------------------------------------------------

create table public.wallet_transactions (
  id uuid primary key default public.generate_uuid_v7(),
  wallet_id uuid not null,
  company_id uuid,

  transaction_type public.wallet_transaction_type not null,
  -- Positive for money in, negative for money out.
  amount numeric(18, 4) not null,
  currency char(3) not null,

  balance_after numeric(18, 4) not null,
  is_pending boolean not null default false,
  available_from date,
  released_at timestamptz,

  -- What produced this entry.
  payment_id uuid,
  refund_id uuid,
  dispute_id uuid,
  payout_id uuid,
  invoice_id uuid,
  reference_note text,

  description text not null,
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  created_by uuid,

  constraint wallet_transactions_amount_check
    check (amount <> 0),
  constraint wallet_transactions_currency_check
    check (currency ~ '^[A-Z]{3}$'),
  constraint wallet_transactions_description_check
    check (length(btrim(description)) between 1 and 300),
  constraint wallet_transactions_metadata_check
    check (jsonb_typeof(metadata) = 'object')
);

comment on table public.wallet_transactions is
  'Append only ledger of every movement in and out of a wallet.';

create index wallet_transactions_wallet_idx
  on public.wallet_transactions (wallet_id, created_at desc);

create index wallet_transactions_type_idx
  on public.wallet_transactions (wallet_id, transaction_type, created_at desc);

create index wallet_transactions_pending_idx
  on public.wallet_transactions (available_from)
  where is_pending;

create index wallet_transactions_company_idx
  on public.wallet_transactions (company_id, created_at desc)
  where company_id is not null;

-- The ledger is never rewritten; a mistake is corrected with a new entry. The
-- single exception is the moment held money matures, which clears the pending
-- flag on the entry that is being released and changes nothing else.
create or replace function public.guard_wallet_transaction_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'The wallet ledger is append only and cannot be deleted'
      using errcode = '42501';
  end if;

  if old.is_pending
     and not new.is_pending
     and new.released_at is not null
     and new.wallet_id = old.wallet_id
     and new.amount = old.amount
     and new.transaction_type = old.transaction_type
     and new.currency = old.currency
     and new.balance_after = old.balance_after
  then
    return new;
  end if;

  raise exception 'A wallet ledger entry cannot be modified'
    using errcode = '42501';
end;
$$;

comment on function public.guard_wallet_transaction_mutation() is
  'Keeps the wallet ledger append only, apart from releasing held funds.';

create trigger wallet_transactions_append_only
  before update or delete on public.wallet_transactions
  for each row execute function public.guard_wallet_transaction_mutation();

-- Posts an entry and moves the cached balances of the wallet.
create or replace function public.post_wallet_transaction(
  p_wallet_id uuid,
  p_transaction_type public.wallet_transaction_type,
  p_amount numeric,
  p_description text,
  p_is_pending boolean default false,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_wallet public.wallets%rowtype;
  v_entry_id uuid;
  v_available numeric;
  v_pending numeric;
begin
  select * into v_wallet from public.wallets where id = p_wallet_id for update;

  if not found then
    raise exception 'Wallet % was not found', p_wallet_id using errcode = 'P0002';
  end if;

  if p_amount = 0 then
    raise exception 'A ledger entry must move a non zero amount' using errcode = '22023';
  end if;

  if v_wallet.is_frozen and p_amount < 0 then
    raise exception 'This wallet is frozen and cannot be debited' using errcode = '42501';
  end if;

  v_available := v_wallet.available_balance;
  v_pending := v_wallet.pending_balance;

  if p_is_pending then
    v_pending := v_pending + p_amount;
  else
    v_available := v_available + p_amount;
  end if;

  if v_available < 0 then
    raise exception 'The wallet balance is not sufficient for this entry'
      using errcode = '22023';
  end if;

  insert into public.wallet_transactions (
    wallet_id, company_id, transaction_type, amount, currency, balance_after,
    is_pending, available_from, description, metadata
  )
  values (
    p_wallet_id, v_wallet.company_id, p_transaction_type, p_amount, v_wallet.currency,
    v_available, p_is_pending,
    case when p_is_pending
         then (current_date + v_wallet.payout_hold_days)
         else null
    end,
    p_description, coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_entry_id;

  update public.wallets
     set available_balance = v_available,
         pending_balance = v_pending,
         lifetime_credited = lifetime_credited + greatest(p_amount, 0),
         lifetime_debited = lifetime_debited + greatest(-p_amount, 0),
         updated_at = now()
   where id = p_wallet_id;

  return v_entry_id;
end;
$$;

comment on function public.post_wallet_transaction(
  uuid, public.wallet_transaction_type, numeric, text, boolean, jsonb
) is 'Appends a ledger entry and updates the cached wallet balances.';

-- Moves money whose hold window has passed from pending to available.
create or replace function public.release_matured_wallet_funds()
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_row record;
  v_count integer := 0;
begin
  for v_row in
    select id, wallet_id, amount
      from public.wallet_transactions
     where is_pending
       and available_from is not null
       and available_from <= current_date
     order by created_at
  loop
    update public.wallet_transactions
       set is_pending = false,
           released_at = now()
     where id = v_row.id;

    update public.wallets
       set pending_balance = greatest(pending_balance - v_row.amount, 0),
           available_balance = available_balance + v_row.amount,
           updated_at = now()
     where id = v_row.wallet_id;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

comment on function public.release_matured_wallet_funds() is
  'Moves held money into the available balance once the hold window has passed.';
