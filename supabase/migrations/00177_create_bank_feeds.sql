-- supabase/migrations/00177_create_bank_feeds.sql
-- Letting the bank send the statement instead of asking for a file.
--
-- An aggregator connection is a consent with an expiry date on it. Open
-- banking rules make that consent time limited, so the expiry is a first
-- class column and the tenant is warned before it lapses rather than after.

create table public.bank_feed_connections (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,

  provider text not null,
  institution_name text not null,
  institution_reference text,
  institution_logo_url text,
  country_code char(2),

  -- The provider side identity of the link, never the bank credentials.
  connection_reference text not null,
  credential_id uuid,
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,

  status text not null default 'pending',
  consent_granted_at timestamptz,
  consent_expires_at timestamptz,
  reauthorization_url text,

  sync_frequency_hours smallint not null default 12,
  last_synced_at timestamptz,
  next_sync_at timestamptz,
  last_error text,
  last_error_at timestamptz,
  consecutive_failures smallint not null default 0,

  account_count integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint bank_feed_connections_provider_check
    check (provider in ('plaid', 'truelayer', 'salt_edge', 'gocardless_bank_data',
                        'yodlee', 'finicity', 'manual_feed')),
  constraint bank_feed_connections_institution_check
    check (length(btrim(institution_name)) between 2 and 120),
  constraint bank_feed_connections_reference_check
    check (length(btrim(connection_reference)) between 4 and 200),
  constraint bank_feed_connections_country_check
    check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  constraint bank_feed_connections_status_check
    check (status in ('pending', 'active', 'reauthorization_required',
                      'expired', 'error', 'disconnected')),
  constraint bank_feed_connections_frequency_check
    check (sync_frequency_hours between 1 and 168),
  constraint bank_feed_connections_failure_check
    check (consecutive_failures between 0 and 100),
  constraint bank_feed_connections_active_check
    check (status <> 'active' or consent_granted_at is not null),
  constraint bank_feed_connections_count_check
    check (account_count >= 0)
);

comment on table public.bank_feed_connections is
  'A live link to a bank through an aggregator, and the consent behind it.';

create unique index bank_feed_connections_reference_unique
  on public.bank_feed_connections (provider, connection_reference)
  where deleted_at is null;

create index bank_feed_connections_due_idx
  on public.bank_feed_connections (next_sync_at)
  where status = 'active' and deleted_at is null;

create index bank_feed_connections_company_idx
  on public.bank_feed_connections (company_id, status)
  where deleted_at is null;

-- -----------------------------------------------------------------------------
-- Which feed account is which ledger account
-- -----------------------------------------------------------------------------

create table public.bank_feed_accounts (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  connection_id uuid not null,
  -- Null until somebody says which of their accounts this is.
  bank_account_id uuid,

  provider_account_reference text not null,
  account_name text not null,
  account_mask text,
  account_type text,
  currency char(3) not null default 'USD',

  current_balance numeric(18, 4),
  available_balance numeric(18, 4),
  balance_updated_at timestamptz,

  is_linked boolean not null default false,
  is_ignored boolean not null default false,
  -- Transactions before this date are history the tenant did not ask for.
  import_from_date date,
  last_transaction_date date,
  feed_cursor text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint bank_feed_accounts_reference_check
    check (length(btrim(provider_account_reference)) between 2 and 200),
  constraint bank_feed_accounts_name_check
    check (length(btrim(account_name)) between 1 and 120),
  constraint bank_feed_accounts_currency_check
    check (currency ~ '^[A-Z]{3}$'),
  constraint bank_feed_accounts_mask_check
    check (account_mask is null or account_mask ~ '^[0-9X*]{2,8}$'),
  constraint bank_feed_accounts_linked_check
    check (not is_linked or bank_account_id is not null)
);

comment on table public.bank_feed_accounts is
  'An account the aggregator reported, and the ledger account it maps to.';

create unique index bank_feed_accounts_reference_unique
  on public.bank_feed_accounts (connection_id, provider_account_reference)
  where deleted_at is null;

create unique index bank_feed_accounts_link_unique
  on public.bank_feed_accounts (bank_account_id)
  where bank_account_id is not null and deleted_at is null;

-- -----------------------------------------------------------------------------
-- Sync runs
-- -----------------------------------------------------------------------------

create table public.bank_feed_syncs (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  connection_id uuid not null,
  feed_account_id uuid,

  trigger_source text not null default 'schedule',
  status text not null default 'running',

  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_ms integer,

  fetched_count integer not null default 0,
  created_count integer not null default 0,
  duplicate_count integer not null default 0,
  matched_count integer not null default 0,

  from_date date,
  to_date date,
  cursor_before text,
  cursor_after text,

  error_code text,
  error_message text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint bank_feed_syncs_trigger_check
    check (trigger_source in ('schedule', 'manual', 'webhook', 'reconnect')),
  constraint bank_feed_syncs_status_check
    check (status in ('running', 'succeeded', 'partial', 'failed')),
  constraint bank_feed_syncs_counts_check
    check (fetched_count >= 0 and created_count >= 0
           and duplicate_count >= 0 and matched_count >= 0),
  constraint bank_feed_syncs_failure_check
    check (status <> 'failed' or error_message is not null),
  constraint bank_feed_syncs_window_check
    check (from_date is null or to_date is null or to_date >= from_date)
);

comment on table public.bank_feed_syncs is
  'One attempt to pull transactions from a bank feed, and what it brought back.';

create index bank_feed_syncs_connection_idx
  on public.bank_feed_syncs (connection_id, started_at desc);

create index bank_feed_syncs_running_idx
  on public.bank_feed_syncs (started_at)
  where status = 'running';
