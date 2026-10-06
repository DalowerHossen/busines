-- supabase/migrations/00178_create_bank_feed_functions.sql
-- Connecting a bank, pulling the lines in, and never importing one twice.

-- Records a completed authorisation with the aggregator.
create or replace function public.connect_bank_feed(
  p_company_id uuid,
  p_provider text,
  p_institution_name text,
  p_connection_reference text,
  p_consent_expires_at timestamptz default null,
  p_credential_id uuid default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_connection_id uuid;
begin
  if not coalesce(
    public.is_service_role() or public.is_company_owner(p_company_id),
    false
  ) then
    raise exception 'Only the account owner can connect a bank'
      using errcode = '42501';
  end if;

  insert into public.bank_feed_connections (
    company_id, provider, institution_name, connection_reference, credential_id,
    status, consent_granted_at, consent_expires_at, next_sync_at, created_by
  )
  values (
    p_company_id, p_provider, p_institution_name, p_connection_reference,
    p_credential_id, 'active', now(),
    coalesce(p_consent_expires_at, now() + interval '90 days'),
    now(), public.current_user_id()
  )
  on conflict (provider, connection_reference) where deleted_at is null
  do update set
    status = 'active',
    consent_granted_at = now(),
    consent_expires_at = excluded.consent_expires_at,
    last_error = null,
    consecutive_failures = 0,
    updated_at = now()
  returning id into v_connection_id;

  return v_connection_id;
end;
$$;

comment on function public.connect_bank_feed(
  uuid, text, text, text, timestamptz, uuid
) is 'Records an authorised bank connection, or refreshes an existing one.';

-- Says which ledger account a feed account belongs to.
create or replace function public.link_feed_account(
  p_feed_account_id uuid,
  p_bank_account_id uuid,
  p_import_from_date date default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_feed public.bank_feed_accounts%rowtype;
begin
  select * into v_feed
    from public.bank_feed_accounts
   where id = p_feed_account_id and deleted_at is null
     for update;

  if not found then
    raise exception 'That feed account does not exist' using errcode = 'P0002';
  end if;

  if not coalesce(
    public.is_service_role() or public.is_company_owner(v_feed.company_id),
    false
  ) then
    raise exception 'Only the account owner can link a bank account'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
      from public.bank_accounts
     where id = p_bank_account_id
       and company_id = v_feed.company_id
       and deleted_at is null
  ) then
    raise exception 'That bank account belongs to another business'
      using errcode = '42501';
  end if;

  update public.bank_feed_accounts
     set bank_account_id = p_bank_account_id,
         is_linked = true,
         is_ignored = false,
         import_from_date = coalesce(p_import_from_date, import_from_date,
                                     current_date - 90),
         updated_at = now()
   where id = p_feed_account_id;

  update public.bank_accounts
     set is_connected = true,
         feed_provider = (
           select provider from public.bank_feed_connections
            where id = v_feed.connection_id
         ),
         feed_account_reference = v_feed.provider_account_reference,
         updated_at = now()
   where id = p_bank_account_id;

  return true;
end;
$$;

comment on function public.link_feed_account(uuid, uuid, date) is
  'Points a feed account at the ledger account it represents.';

-- Opens a sync run so the worker has something to report against.
create or replace function public.start_feed_sync(
  p_connection_id uuid,
  p_feed_account_id uuid default null,
  p_trigger text default 'schedule'
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_connection public.bank_feed_connections%rowtype;
  v_sync_id uuid;
begin
  select * into v_connection
    from public.bank_feed_connections
   where id = p_connection_id and deleted_at is null;

  if not found then
    raise exception 'That bank connection does not exist' using errcode = 'P0002';
  end if;

  if not coalesce(
    public.is_service_role()
    or public.is_super_admin()
    or public.is_company_owner(v_connection.company_id),
    false
  ) then
    raise exception 'That bank connection is not yours' using errcode = '42501';
  end if;

  if v_connection.status <> 'active' then
    raise exception 'That connection needs to be authorised again before it syncs'
      using errcode = '22023';
  end if;

  insert into public.bank_feed_syncs (
    company_id, connection_id, feed_account_id, trigger_source, status
  )
  values (
    v_connection.company_id, p_connection_id, p_feed_account_id,
    coalesce(p_trigger, 'schedule'), 'running'
  )
  returning id into v_sync_id;

  return v_sync_id;
end;
$$;

comment on function public.start_feed_sync(uuid, uuid, text) is
  'Opens a bank feed sync run and returns it to the worker.';

-- Writes one line from the feed, ignoring anything already imported.
create or replace function public.ingest_feed_transaction(
  p_sync_id uuid,
  p_feed_account_id uuid,
  p_provider_transaction_id text,
  p_amount numeric,
  p_transaction_date date,
  p_description text,
  p_counterparty_name text default null,
  p_reference text default null,
  p_balance_after numeric default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_feed public.bank_feed_accounts%rowtype;
  v_transaction_id uuid;
begin
  if not coalesce(public.is_service_role() or public.is_super_admin(), false) then
    raise exception 'Bank lines are imported by the platform' using errcode = '42501';
  end if;

  select * into v_feed
    from public.bank_feed_accounts
   where id = p_feed_account_id and deleted_at is null;

  if not found or not v_feed.is_linked then
    return null;
  end if;

  if v_feed.import_from_date is not null
     and p_transaction_date < v_feed.import_from_date then
    return null;
  end if;

  insert into public.bank_transactions (
    company_id, bank_account_id, amount, currency, transaction_date,
    description, counterparty_name, reference, balance_after,
    provider_transaction_id, import_source, status
  )
  values (
    v_feed.company_id, v_feed.bank_account_id, p_amount, v_feed.currency,
    p_transaction_date, p_description, p_counterparty_name, p_reference,
    p_balance_after, p_provider_transaction_id, 'bank_feed', 'unmatched'
  )
  on conflict (bank_account_id, provider_transaction_id)
    where provider_transaction_id is not null
  do nothing
  returning id into v_transaction_id;

  if v_transaction_id is null then
    update public.bank_feed_syncs
       set duplicate_count = duplicate_count + 1,
           fetched_count = fetched_count + 1,
           updated_at = now()
     where id = p_sync_id;

    return null;
  end if;

  update public.bank_feed_syncs
     set created_count = created_count + 1,
         fetched_count = fetched_count + 1,
         updated_at = now()
   where id = p_sync_id;

  update public.bank_feed_accounts
     set last_transaction_date = greatest(
           coalesce(last_transaction_date, p_transaction_date), p_transaction_date
         ),
         updated_at = now()
   where id = p_feed_account_id;

  return v_transaction_id;
end;
$$;

comment on function public.ingest_feed_transaction(
  uuid, uuid, text, numeric, date, text, text, text, numeric
) is 'Imports one statement line from a feed, once, and counts the duplicates.';

-- Closes a sync run and schedules the next one.
create or replace function public.complete_feed_sync(
  p_sync_id uuid,
  p_status text default 'succeeded',
  p_error_message text default null,
  p_cursor_after text default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_sync public.bank_feed_syncs%rowtype;
  v_connection public.bank_feed_connections%rowtype;
begin
  if not coalesce(public.is_service_role() or public.is_super_admin(), false) then
    raise exception 'Sync runs are closed by the platform' using errcode = '42501';
  end if;

  select * into v_sync
    from public.bank_feed_syncs
   where id = p_sync_id
     for update;

  if not found or v_sync.status <> 'running' then
    return false;
  end if;

  update public.bank_feed_syncs
     set status = p_status,
         finished_at = now(),
         duration_ms = greatest(
           (extract(epoch from (now() - started_at)) * 1000)::integer, 0
         ),
         error_message = p_error_message,
         cursor_after = p_cursor_after,
         updated_at = now()
   where id = p_sync_id;

  select * into v_connection
    from public.bank_feed_connections
   where id = v_sync.connection_id;

  if p_status = 'failed' then
    update public.bank_feed_connections
       set consecutive_failures = consecutive_failures + 1,
           last_error = p_error_message,
           last_error_at = now(),
           status = case
             when consecutive_failures + 1 >= 5 then 'error'
             else status
           end,
           next_sync_at = now() + make_interval(
             mins => least(30 * (consecutive_failures + 1), 720)
           ),
           updated_at = now()
     where id = v_sync.connection_id;
  else
    update public.bank_feed_connections
       set consecutive_failures = 0,
           last_error = null,
           last_synced_at = now(),
           next_sync_at = now()
             + make_interval(hours => v_connection.sync_frequency_hours),
           updated_at = now()
     where id = v_sync.connection_id;

    if p_cursor_after is not null and v_sync.feed_account_id is not null then
      update public.bank_feed_accounts
         set feed_cursor = p_cursor_after,
             updated_at = now()
       where id = v_sync.feed_account_id;
    end if;
  end if;

  return true;
end;
$$;

comment on function public.complete_feed_sync(uuid, text, text, text) is
  'Closes a sync run, records the failure count and books the next attempt.';

-- Moves connections whose consent has run out into a state the tenant sees.
create or replace function public.expire_bank_feed_consents()
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  if not coalesce(public.is_service_role() or public.is_super_admin(), false) then
    raise exception 'Only the platform expires bank consents' using errcode = '42501';
  end if;

  with expired as (
    update public.bank_feed_connections
       set status = 'expired',
           next_sync_at = null,
           updated_at = now()
     where deleted_at is null
       and status in ('active', 'reauthorization_required')
       and consent_expires_at is not null
       and consent_expires_at <= now()
    returning 1
  )
  select count(*)::int into v_count from expired;

  return v_count;
end;
$$;

comment on function public.expire_bank_feed_consents() is
  'Marks bank connections whose consent window has closed.';

-- Disconnects a feed without deleting the statement lines it brought in.
create or replace function public.disconnect_bank_feed(
  p_connection_id uuid,
  p_reason text default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_connection public.bank_feed_connections%rowtype;
begin
  select * into v_connection
    from public.bank_feed_connections
   where id = p_connection_id and deleted_at is null
     for update;

  if not found then
    return false;
  end if;

  if not coalesce(
    public.is_service_role() or public.is_company_owner(v_connection.company_id),
    false
  ) then
    raise exception 'That bank connection is not yours to remove'
      using errcode = '42501';
  end if;

  update public.bank_feed_connections
     set status = 'disconnected',
         last_error = p_reason,
         access_token_encrypted = null,
         refresh_token_encrypted = null,
         next_sync_at = null,
         updated_at = now()
   where id = p_connection_id;

  update public.bank_accounts
     set is_connected = false,
         updated_at = now()
   where id in (
     select bank_account_id
       from public.bank_feed_accounts
      where connection_id = p_connection_id
        and bank_account_id is not null
   );

  update public.bank_feed_accounts
     set is_linked = false,
         updated_at = now()
   where connection_id = p_connection_id;

  return true;
end;
$$;

comment on function public.disconnect_bank_feed(uuid, text) is
  'Ends a bank connection and discards its tokens, keeping the history.';

-- The state of every feed a tenant depends on.
create or replace function public.bank_feed_health(p_company_id uuid)
returns table (
  connection_id uuid,
  institution_name text,
  status text,
  last_synced_at timestamptz,
  consent_expires_at timestamptz,
  days_until_expiry integer,
  consecutive_failures smallint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not coalesce(
    public.is_service_role() or public.has_company_access(p_company_id),
    false
  ) then
    raise exception 'That account is not yours to read' using errcode = '42501';
  end if;

  return query
  select c.id,
         c.institution_name,
         c.status,
         c.last_synced_at,
         c.consent_expires_at,
         case
           when c.consent_expires_at is null then null
           else greatest((c.consent_expires_at::date - current_date), 0)
         end,
         c.consecutive_failures
    from public.bank_feed_connections as c
   where c.company_id = p_company_id
     and c.deleted_at is null
   order by c.institution_name;
end;
$$;

comment on function public.bank_feed_health(uuid) is
  'Lists every bank connection with its freshness and consent countdown.';
