-- supabase/migrations/00095_create_bank_accounts.sql
-- Bank accounts and the transactions that arrive from them.
--
-- A statement line is a fact: it is never edited, only matched. Matching is
-- what turns a bank feed into bookkeeping, so the line keeps its own identity
-- for the whole of its life and the match sits beside it.

create table public.bank_accounts (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,

  name text not null,
  institution_name text,
  account_type text not null default 'checking',

  -- Only the last digits are stored; the full number is never needed.
  account_number_last4 text,
  routing_number_last4 text,
  iban_last4 text,
  currency char(3) not null default 'USD',
  country_code char(2),

  ledger_account_id uuid,

  -- Feed state, when the account is connected to an aggregator.
  is_connected boolean not null default false,
  feed_provider text,
  feed_account_reference text,
  feed_last_synced_at timestamptz,
  feed_last_error text,
  feed_cursor text,

  current_balance numeric(18, 4) not null default 0,
  available_balance numeric(18, 4) not null default 0,
  balance_updated_at timestamptz,
  -- Balance the tenant has actually reconciled up to.
  reconciled_balance numeric(18, 4) not null default 0,
  reconciled_through date,

  is_primary boolean not null default false,
  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint bank_accounts_name_check
    check (length(btrim(name)) between 2 and 80),
  constraint bank_accounts_type_check
    check (account_type in ('checking', 'savings', 'credit_card', 'cash',
                            'payment_provider', 'mobile_wallet')),
  constraint bank_accounts_currency_check
    check (currency ~ '^[A-Z]{3}$'),
  constraint bank_accounts_last4_check
    check (account_number_last4 is null or account_number_last4 ~ '^[0-9A-Za-z]{2,4}$'),
  constraint bank_accounts_country_check
    check (country_code is null or country_code ~ '^[A-Z]{2}$')
);

comment on table public.bank_accounts is
  'The accounts money actually moves through, with their feed state.';
comment on column public.bank_accounts.account_number_last4 is
  'Only the final digits are kept; the full number is never stored.';

create unique index bank_accounts_primary_unique
  on public.bank_accounts (company_id)
  where is_primary and deleted_at is null;

create index bank_accounts_company_idx
  on public.bank_accounts (company_id)
  where deleted_at is null;

create unique index bank_accounts_feed_unique
  on public.bank_accounts (feed_provider, feed_account_reference)
  where feed_account_reference is not null and deleted_at is null;

-- -----------------------------------------------------------------------------
-- Statement lines
-- -----------------------------------------------------------------------------

create table public.bank_transactions (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  bank_account_id uuid not null,

  -- Positive is money in, negative is money out.
  amount numeric(18, 4) not null,
  currency char(3) not null default 'USD',
  transaction_date date not null,
  posted_date date,

  description text not null,
  counterparty_name text,
  reference text,
  category_hint text,
  balance_after numeric(18, 4),

  -- Identity from the feed, which is what keeps an import idempotent.
  provider_transaction_id text,
  import_batch_id uuid,
  import_source text not null default 'manual',

  status text not null default 'unmatched',
  matched_at timestamptz,
  matched_by uuid,
  match_confidence numeric(5, 2),
  journal_entry_id uuid,

  -- Deliberately excluded from reconciliation by a person.
  is_ignored boolean not null default false,
  ignore_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint bank_transactions_amount_check
    check (amount <> 0),
  constraint bank_transactions_currency_check
    check (currency ~ '^[A-Z]{3}$'),
  constraint bank_transactions_description_check
    check (length(btrim(description)) between 1 and 300),
  constraint bank_transactions_status_check
    check (status in ('unmatched', 'suggested', 'matched', 'ignored', 'split')),
  constraint bank_transactions_source_check
    check (import_source in ('manual', 'csv_import', 'bank_feed', 'provider_payout')),
  constraint bank_transactions_confidence_check
    check (match_confidence is null or match_confidence between 0 and 100),
  constraint bank_transactions_ignored_check
    check (not is_ignored or ignore_reason is not null)
);

comment on table public.bank_transactions is
  'Statement lines exactly as the bank reported them, and their match state.';

create unique index bank_transactions_provider_unique
  on public.bank_transactions (bank_account_id, provider_transaction_id)
  where provider_transaction_id is not null;

create index bank_transactions_account_idx
  on public.bank_transactions (bank_account_id, transaction_date desc);

create index bank_transactions_unmatched_idx
  on public.bank_transactions (company_id, transaction_date desc)
  where status = 'unmatched' and not is_ignored;

create index bank_transactions_amount_idx
  on public.bank_transactions (company_id, amount, transaction_date);

-- -----------------------------------------------------------------------------
-- Imports
-- -----------------------------------------------------------------------------

create table public.bank_import_batches (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  bank_account_id uuid not null,

  source text not null default 'csv_import',
  file_name text,
  status public.import_status not null default 'uploaded',

  row_count integer not null default 0,
  imported_count integer not null default 0,
  duplicate_count integer not null default 0,
  failed_count integer not null default 0,
  error_detail jsonb not null default '[]'::jsonb,

  period_start date,
  period_end date,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,

  constraint bank_import_batches_counts_check
    check (row_count >= 0 and imported_count >= 0 and duplicate_count >= 0
           and failed_count >= 0),
  constraint bank_import_batches_errors_check
    check (jsonb_typeof(error_detail) = 'array')
);

comment on table public.bank_import_batches is
  'One statement upload or feed sync, with what it added and what it skipped.';

create index bank_import_batches_account_idx
  on public.bank_import_batches (bank_account_id, created_at desc);

-- Adds one statement line, ignoring anything already imported.
create or replace function public.import_bank_transaction(
  p_bank_account_id uuid,
  p_amount numeric,
  p_transaction_date date,
  p_description text,
  p_provider_transaction_id text default null,
  p_counterparty_name text default null,
  p_reference text default null,
  p_import_batch_id uuid default null,
  p_import_source text default 'csv_import'
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_account public.bank_accounts%rowtype;
  v_id uuid;
begin
  select * into v_account
    from public.bank_accounts
   where id = p_bank_account_id and deleted_at is null;

  if not found then
    raise exception 'Bank account % was not found', p_bank_account_id
      using errcode = 'P0002';
  end if;

  if p_provider_transaction_id is not null then
    select id into v_id
      from public.bank_transactions
     where bank_account_id = p_bank_account_id
       and provider_transaction_id = p_provider_transaction_id;

    if v_id is not null then
      return v_id;
    end if;
  end if;

  insert into public.bank_transactions (
    company_id, bank_account_id, amount, currency, transaction_date,
    description, counterparty_name, reference, provider_transaction_id,
    import_batch_id, import_source
  )
  values (
    v_account.company_id, p_bank_account_id, round(p_amount, 4), v_account.currency,
    p_transaction_date, p_description, p_counterparty_name, p_reference,
    p_provider_transaction_id, p_import_batch_id, p_import_source
  )
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.import_bank_transaction(
  uuid, numeric, date, text, text, text, text, uuid, text
) is 'Adds a statement line unless the feed has already delivered it.';

-- A statement line is a fact and is never rewritten, only matched.
create or replace function public.guard_bank_transaction()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.amount is distinct from old.amount
     or new.transaction_date is distinct from old.transaction_date
     or new.description is distinct from old.description
     or new.bank_account_id is distinct from old.bank_account_id
     or new.provider_transaction_id is distinct from old.provider_transaction_id then
    raise exception 'A statement line cannot be edited, only matched'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function public.guard_bank_transaction() is
  'Keeps what the bank reported exactly as the bank reported it.';
