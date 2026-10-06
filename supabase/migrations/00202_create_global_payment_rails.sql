-- supabase/migrations/00202_create_global_payment_rails.sql
-- Two more ways for money to arrive and leave: Adyen and Nium.
--
-- Adyen is a card acquirer that also runs balance accounts for platforms, so
-- a tenant can be paid into its own balance while the platform keeps its
-- commission. Nium is the opposite half of the journey: a payout network that
-- reaches bank accounts and wallets in most countries from one funded wallet.
--
-- Both need the same thing from the database. The provider has to be a known
-- value so a payment row can name it, the connection details have to live
-- somewhere the admin panel can edit at runtime, and each tenant needs a row
-- that remembers which account holder, balance account or wallet belongs to
-- it on the provider side.

-- -----------------------------------------------------------------------------
-- The providers themselves
-- -----------------------------------------------------------------------------

alter type public.gateway_provider add value if not exists 'adyen';
alter type public.gateway_provider add value if not exists 'nium';

alter type public.payout_method add value if not exists 'adyen_transfer';
alter type public.payout_method add value if not exists 'nium_transfer';

-- -----------------------------------------------------------------------------
-- The credentials the admin panel asks for
-- -----------------------------------------------------------------------------

insert into public.integration_providers (
  provider_key, name, category, summary, configurable_by, field_schema,
  supports_test_mode, test_endpoint, documentation_url, logo_slug, sort_order
)
values
  ('adyen', 'Adyen', 'payment',
   'Card acquiring with balance accounts, so each tenant is paid directly.',
   'both',
   '[{"key": "api_key", "label": "API key", "type": "secret", "required": true, "env_var": "ADYEN_API_KEY"},
     {"key": "merchant_account", "label": "Merchant account", "type": "text", "required": true, "env_var": "ADYEN_MERCHANT_ACCOUNT"},
     {"key": "hmac_key", "label": "Notification HMAC key", "type": "secret", "required": true, "env_var": "ADYEN_HMAC_KEY"},
     {"key": "live_url_prefix", "label": "Live endpoint prefix", "type": "text", "required": false, "env_var": "ADYEN_LIVE_URL_PREFIX"},
     {"key": "balance_platform", "label": "Balance platform", "type": "text", "required": false, "env_var": "ADYEN_BALANCE_PLATFORM"}]'::jsonb,
   true, 'https://checkout-test.adyen.com/v71/paymentMethods',
   'https://docs.adyen.com/api-explorer/', 'adyen', 25),

  ('nium', 'Nium', 'payout',
   'Cross border payouts to bank accounts and wallets in most countries.',
   'platform',
   '[{"key": "api_key", "label": "API key", "type": "secret", "required": true, "env_var": "NIUM_API_KEY"},
     {"key": "client_hash_id", "label": "Client identifier", "type": "text", "required": true, "env_var": "NIUM_CLIENT_HASH_ID"},
     {"key": "customer_hash_id", "label": "Customer identifier", "type": "text", "required": false, "env_var": "NIUM_CUSTOMER_HASH_ID"},
     {"key": "wallet_hash_id", "label": "Funding wallet", "type": "text", "required": false, "env_var": "NIUM_WALLET_HASH_ID"},
     {"key": "webhook_secret", "label": "Webhook secret", "type": "secret", "required": false, "env_var": "NIUM_WEBHOOK_SECRET"}]'::jsonb,
   true, 'https://gateway.nium.com/api/v1/client',
   'https://docs.nium.com/docs/getting-started', 'nium', 75)
on conflict (provider_key) do nothing;

-- -----------------------------------------------------------------------------
-- Who a tenant is on the provider side
-- -----------------------------------------------------------------------------

-- A tenant exists twice: once here, and once inside Adyen or Nium as an
-- account holder with a balance account or a wallet. This table is the thread
-- between the two, kept per mode so a test connection never pays real money
-- into a live balance.
create table public.payment_rail_accounts (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,

  rail text not null,
  mode text not null default 'test',

  -- The references the provider gives back when the tenant is onboarded.
  account_holder_reference text,
  balance_account_reference text,
  wallet_reference text,
  legal_entity_reference text,

  default_currency char(3) not null default 'USD',
  country_code char(2) not null default 'US',

  status text not null default 'pending',
  status_note text,

  -- What the provider says this tenant is allowed to do yet, copied from the
  -- capability list so the interface can explain a refusal without a call.
  capabilities jsonb not null default '{}'::jsonb,
  is_receiving_enabled boolean not null default false,
  is_sending_enabled boolean not null default false,

  -- The platform's cut, taken as a split at the moment of the payment.
  platform_fee_percentage numeric(5, 2) not null default 0,

  onboarding_url text,
  last_synced_at timestamptz,
  last_error text,
  last_error_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint payment_rail_accounts_rail_check
    check (rail in ('adyen', 'nium')),
  constraint payment_rail_accounts_mode_check
    check (mode in ('test', 'live')),
  constraint payment_rail_accounts_status_check
    check (status in ('pending', 'onboarding', 'active', 'restricted',
                      'suspended', 'closed')),
  constraint payment_rail_accounts_currency_check
    check (default_currency ~ '^[A-Z]{3}$'),
  constraint payment_rail_accounts_country_check
    check (country_code ~ '^[A-Z]{2}$'),
  constraint payment_rail_accounts_capabilities_check
    check (jsonb_typeof(capabilities) = 'object'),
  constraint payment_rail_accounts_fee_check
    check (platform_fee_percentage >= 0 and platform_fee_percentage <= 30),
  constraint payment_rail_accounts_reference_check
    check (
      (rail = 'adyen' and (account_holder_reference is not null
                           or balance_account_reference is not null))
      or (rail = 'nium' and (wallet_reference is not null
                             or account_holder_reference is not null))
      or status in ('pending', 'onboarding')
    ),
  constraint payment_rail_accounts_active_check
    check (status <> 'active' or last_synced_at is not null),
  constraint payment_rail_accounts_note_check
    check (status_note is null or length(btrim(status_note)) between 3 and 500)
);

comment on table public.payment_rail_accounts is
  'The identity a tenant has inside Adyen or Nium, one row per rail and mode.';

comment on column public.payment_rail_accounts.platform_fee_percentage is
  'The share split off to the platform balance when a payment is taken.';

create unique index payment_rail_accounts_unique
  on public.payment_rail_accounts (company_id, rail, mode)
  where deleted_at is null;

create index payment_rail_accounts_status_idx
  on public.payment_rail_accounts (rail, status)
  where deleted_at is null;

alter table public.payment_rail_accounts
  add constraint payment_rail_accounts_company_fk
  foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.payment_rail_accounts
  add constraint payment_rail_accounts_created_by_fk
  foreign key (created_by) references public.users (id) on delete set null;

alter table public.payment_rail_accounts
  add constraint payment_rail_accounts_updated_by_fk
  foreign key (updated_by) references public.users (id) on delete set null;

select public.install_standard_triggers('payment_rail_accounts');

-- -----------------------------------------------------------------------------
-- Linking an account
-- -----------------------------------------------------------------------------

create or replace function public.link_payment_rail_account(
  p_company_id uuid,
  p_rail text,
  p_mode text,
  p_account_holder_reference text default null,
  p_balance_account_reference text default null,
  p_wallet_reference text default null,
  p_default_currency text default 'USD',
  p_country_code text default 'US',
  p_platform_fee_percentage numeric default 0
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_rail text := lower(btrim(coalesce(p_rail, '')));
  v_mode text := lower(btrim(coalesce(p_mode, 'test')));
  v_account_id uuid;
begin
  if not (coalesce(public.is_super_admin(), false)
          or public.is_company_owner(p_company_id)) then
    raise exception 'Only an owner or the platform team can connect a payment rail'
      using errcode = '42501';
  end if;

  if v_rail not in ('adyen', 'nium') then
    raise exception 'Unknown payment rail %', p_rail using errcode = '22023';
  end if;

  if v_mode not in ('test', 'live') then
    raise exception 'A payment rail runs in test or live mode' using errcode = '22023';
  end if;

  insert into public.payment_rail_accounts (
    company_id, rail, mode, account_holder_reference,
    balance_account_reference, wallet_reference, default_currency,
    country_code, platform_fee_percentage, status, created_by, updated_by
  )
  values (
    p_company_id,
    v_rail,
    v_mode,
    nullif(btrim(coalesce(p_account_holder_reference, '')), ''),
    nullif(btrim(coalesce(p_balance_account_reference, '')), ''),
    nullif(btrim(coalesce(p_wallet_reference, '')), ''),
    upper(btrim(coalesce(p_default_currency, 'USD')))::char(3),
    upper(btrim(coalesce(p_country_code, 'US')))::char(2),
    coalesce(p_platform_fee_percentage, 0),
    'onboarding',
    public.current_user_id(),
    public.current_user_id()
  )
  on conflict (company_id, rail, mode) where deleted_at is null
  do update set
    account_holder_reference =
      coalesce(excluded.account_holder_reference,
               payment_rail_accounts.account_holder_reference),
    balance_account_reference =
      coalesce(excluded.balance_account_reference,
               payment_rail_accounts.balance_account_reference),
    wallet_reference =
      coalesce(excluded.wallet_reference,
               payment_rail_accounts.wallet_reference),
    default_currency = excluded.default_currency,
    country_code = excluded.country_code,
    platform_fee_percentage = excluded.platform_fee_percentage,
    updated_by = public.current_user_id()
  returning id into v_account_id;

  perform public.record_manual_audit_entry(
    'update'::public.audit_action,
    'payment_rail_account',
    v_account_id,
    p_company_id,
    'Payment rail connection saved.',
    jsonb_build_object('rail', v_rail, 'mode', v_mode)
  );

  return v_account_id;
end;
$$;

comment on function public.link_payment_rail_account(
  uuid, text, text, text, text, text, text, text, numeric
) is 'Records which account holder, balance account or wallet a tenant owns.';

-- -----------------------------------------------------------------------------
-- Keeping the state honest
-- -----------------------------------------------------------------------------

-- Only the server knows what the provider replied, so the state of a rail is
-- written by the service role after a call, never by a person in a form.
create or replace function public.sync_payment_rail_account(
  p_account_id uuid,
  p_status text,
  p_capabilities jsonb default '{}'::jsonb,
  p_is_receiving_enabled boolean default false,
  p_is_sending_enabled boolean default false,
  p_onboarding_url text default null,
  p_note text default null
)
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_account public.payment_rail_accounts%rowtype;
  v_status text := lower(btrim(coalesce(p_status, '')));
begin
  if not coalesce(public.is_service_role(), false) then
    raise exception 'Only the platform service may record a rail state'
      using errcode = '42501';
  end if;

  if v_status not in ('pending', 'onboarding', 'active', 'restricted',
                      'suspended', 'closed') then
    raise exception 'Unknown payment rail state %', p_status using errcode = '22023';
  end if;

  select * into v_account
    from public.payment_rail_accounts
   where id = p_account_id
     and deleted_at is null
   for update;

  if not found then
    raise exception 'Payment rail account % was not found', p_account_id
      using errcode = 'P0002';
  end if;

  update public.payment_rail_accounts
     set status = v_status,
         status_note = nullif(btrim(coalesce(p_note, '')), ''),
         capabilities = coalesce(p_capabilities, '{}'::jsonb),
         is_receiving_enabled = coalesce(p_is_receiving_enabled, false),
         is_sending_enabled = coalesce(p_is_sending_enabled, false),
         onboarding_url = nullif(btrim(coalesce(p_onboarding_url, '')), ''),
         last_synced_at = now(),
         last_error = case when v_status = 'active' then null else last_error end
   where id = p_account_id;

  return v_status;
end;
$$;

comment on function public.sync_payment_rail_account(
  uuid, text, jsonb, boolean, boolean, text, text
) is 'Writes back what Adyen or Nium said about a tenant account.';

create or replace function public.record_payment_rail_error(
  p_account_id uuid,
  p_message text
)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  if not coalesce(public.is_service_role(), false) then
    raise exception 'Only the platform service may record a rail failure'
      using errcode = '42501';
  end if;

  update public.payment_rail_accounts
     set last_error = left(btrim(coalesce(p_message, 'Unknown failure')), 500),
         last_error_at = now()
   where id = p_account_id
     and deleted_at is null;
end;
$$;

comment on function public.record_payment_rail_error(uuid, text) is
  'Remembers the last refusal from a payment rail for the tenant to read.';

-- -----------------------------------------------------------------------------
-- Reading the rails back
-- -----------------------------------------------------------------------------

create or replace function public.payment_rails_for_company(
  p_company_id uuid
)
returns table (
  id uuid,
  rail text,
  mode text,
  status text,
  status_note text,
  account_holder_reference text,
  balance_account_reference text,
  wallet_reference text,
  default_currency char(3),
  country_code char(2),
  platform_fee_percentage numeric,
  is_receiving_enabled boolean,
  is_sending_enabled boolean,
  onboarding_url text,
  last_synced_at timestamptz,
  last_error text,
  last_error_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not (coalesce(public.is_service_role(), false)
          or public.has_company_access(p_company_id)) then
    raise exception 'That company is not yours to read' using errcode = '42501';
  end if;

  return query
    select a.id,
           a.rail,
           a.mode,
           a.status,
           a.status_note,
           a.account_holder_reference,
           a.balance_account_reference,
           a.wallet_reference,
           a.default_currency,
           a.country_code,
           a.platform_fee_percentage,
           a.is_receiving_enabled,
           a.is_sending_enabled,
           a.onboarding_url,
           a.last_synced_at,
           a.last_error,
           a.last_error_at
      from public.payment_rail_accounts a
     where a.company_id = p_company_id
       and a.deleted_at is null
     order by a.rail, a.mode;
end;
$$;

comment on function public.payment_rails_for_company(uuid) is
  'Every Adyen and Nium connection a tenant has, with its current state.';

-- -----------------------------------------------------------------------------
-- Row level security
-- -----------------------------------------------------------------------------

alter table public.payment_rail_accounts enable row level security;
alter table public.payment_rail_accounts force row level security;

create policy payment_rail_accounts_select on public.payment_rail_accounts
  for select to authenticated
  using (
    public.is_super_admin()
    or (deleted_at is null and public.has_company_access(company_id))
  );

create policy payment_rail_accounts_insert on public.payment_rail_accounts
  for insert to authenticated
  with check (
    public.is_super_admin()
    or public.is_company_owner(company_id)
  );

create policy payment_rail_accounts_update on public.payment_rail_accounts
  for update to authenticated
  using (
    public.is_super_admin()
    or (deleted_at is null and public.is_company_owner(company_id))
  )
  with check (
    public.is_super_admin()
    or public.is_company_owner(company_id)
  );

-- -----------------------------------------------------------------------------
-- Privileges
-- -----------------------------------------------------------------------------

revoke all on public.payment_rail_accounts from public, authenticated;
grant select on public.payment_rail_accounts to authenticated;

revoke all on function public.link_payment_rail_account(
  uuid, text, text, text, text, text, text, text, numeric
) from public;
grant execute on function public.link_payment_rail_account(
  uuid, text, text, text, text, text, text, text, numeric
) to authenticated, service_role;

revoke all on function public.sync_payment_rail_account(
  uuid, text, jsonb, boolean, boolean, text, text
) from public, authenticated;
grant execute on function public.sync_payment_rail_account(
  uuid, text, jsonb, boolean, boolean, text, text
) to service_role;

revoke all on function public.record_payment_rail_error(uuid, text)
  from public, authenticated;
grant execute on function public.record_payment_rail_error(uuid, text)
  to service_role;

revoke all on function public.payment_rails_for_company(uuid) from public;
grant execute on function public.payment_rails_for_company(uuid)
  to authenticated, service_role;
