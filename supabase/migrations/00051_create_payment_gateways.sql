-- supabase/migrations/00051_create_payment_gateways.sql
-- Payment gateway configuration.
--
-- Credentials are never written into the source tree or the deployment
-- environment. They live here, encrypted, and are resolved at runtime in the
-- order database, environment variable, built in default. Changing a key in
-- the admin panel therefore takes effect without a rebuild.
--
-- A gateway row belongs either to the platform (the merchant of record
-- account) or to a single company (the tenant collects directly). Any provider
-- that is not built in can be added through the custom adapter, which keeps
-- its endpoints and field mapping in a JSON configuration.

create table public.payment_gateways (
  id uuid primary key default public.generate_uuid_v7(),

  owner_type public.gateway_owner_type not null default 'platform',
  -- Null for a platform gateway, set for a tenant owned gateway.
  company_id uuid,

  provider public.gateway_provider not null,
  display_name text not null,
  mode public.gateway_mode not null default 'test',

  is_enabled boolean not null default false,
  is_default boolean not null default false,
  supports_payouts boolean not null default false,
  supports_refunds boolean not null default true,
  supports_partial_capture boolean not null default false,
  requires_3ds boolean not null default false,

  -- Encrypted credential bundle. The application decrypts it with the server
  -- side key; the database only ever sees the ciphertext.
  credentials_encrypted text,
  credentials_key_version smallint not null default 1,
  credentials_fingerprint text,
  publishable_key text,

  -- Rotation with a grace period: the previous secret stays valid for a few
  -- minutes so in flight requests are not dropped.
  previous_credentials_encrypted text,
  previous_credentials_valid_until timestamptz,

  webhook_secret_encrypted text,
  webhook_endpoint_path text,
  webhook_last_received_at timestamptz,

  -- Custom adapter description: endpoints, field mapping, authentication
  -- style. A new provider can be added from the admin panel with no code
  -- change by filling this in.
  adapter_config jsonb not null default '{}'::jsonb,

  supported_currencies text[] not null default array['USD']::text[],
  supported_countries text[],
  minimum_amount numeric(18, 4),
  maximum_amount numeric(18, 4),

  -- Fees charged by the provider, used by the fee transparency report.
  fee_percentage numeric(7, 4) not null default 0,
  fee_fixed_amount numeric(18, 4) not null default 0,
  fee_currency char(3) not null default 'USD',

  -- Operational health, shown next to the Test Connection button.
  last_tested_at timestamptz,
  last_test_succeeded boolean,
  last_test_message text,
  last_used_at timestamptz,
  last_error_at timestamptz,
  last_error_message text,
  consecutive_failure_count smallint not null default 0,

  display_order smallint not null default 0,
  instructions text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint payment_gateways_display_name_check
    check (length(btrim(display_name)) between 1 and 80),
  constraint payment_gateways_owner_check
    check (
      (owner_type = 'platform' and company_id is null)
      or (owner_type = 'company' and company_id is not null)
    ),
  constraint payment_gateways_adapter_config_check
    check (jsonb_typeof(adapter_config) = 'object'),
  constraint payment_gateways_custom_adapter_check
    check (provider <> 'custom' or adapter_config <> '{}'::jsonb),
  constraint payment_gateways_fee_check
    check (fee_percentage between 0 and 100 and fee_fixed_amount >= 0),
  constraint payment_gateways_fee_currency_check
    check (fee_currency ~ '^[A-Z]{3}$'),
  constraint payment_gateways_amount_range_check
    check (maximum_amount is null or minimum_amount is null or maximum_amount >= minimum_amount),
  constraint payment_gateways_fingerprint_check
    check (credentials_fingerprint is null or credentials_fingerprint ~ '^[0-9a-f]{64}$'),
  constraint payment_gateways_failure_count_check
    check (consecutive_failure_count >= 0)
);

comment on table public.payment_gateways is
  'Runtime configuration of every payment provider, platform wide or per tenant.';
comment on column public.payment_gateways.adapter_config is
  'Endpoints and field mapping that let an unknown provider be added without code.';
comment on column public.payment_gateways.previous_credentials_valid_until is
  'Grace window during which the rotated out secret is still accepted.';

create unique index payment_gateways_platform_unique
  on public.payment_gateways (provider, mode)
  where owner_type = 'platform' and deleted_at is null;

create unique index payment_gateways_company_unique
  on public.payment_gateways (company_id, provider, mode)
  where owner_type = 'company' and deleted_at is null;

create unique index payment_gateways_default_unique
  on public.payment_gateways (coalesce(company_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where is_default and is_enabled and deleted_at is null;

create index payment_gateways_enabled_idx
  on public.payment_gateways (owner_type, is_enabled, display_order)
  where deleted_at is null;

create index payment_gateways_company_idx
  on public.payment_gateways (company_id)
  where company_id is not null and deleted_at is null;

-- -----------------------------------------------------------------------------
-- Availability rules
-- -----------------------------------------------------------------------------

-- A provider can be switched off globally by the platform and, independently,
-- by each tenant. Both switches must be on for a method to appear on a
-- payment page.
create table public.gateway_availability (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  provider public.gateway_provider not null,

  is_enabled_by_tenant boolean not null default true,
  accepts_payments boolean not null default true,
  accepts_payouts boolean not null default false,
  disabled_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);

comment on table public.gateway_availability is
  'Per tenant switch for each provider, combined with the platform switch.';

create unique index gateway_availability_unique
  on public.gateway_availability (company_id, provider);

-- Reports whether a provider may currently be used by a company.
create or replace function public.is_gateway_available(
  p_company_id uuid,
  p_provider public.gateway_provider,
  p_mode public.gateway_mode default 'live'
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_platform_enabled boolean;
  v_tenant_enabled boolean;
  v_company_gateway_enabled boolean;
begin
  select is_enabled
    into v_platform_enabled
    from public.payment_gateways
   where owner_type = 'platform'
     and provider = p_provider
     and mode = p_mode
     and deleted_at is null;

  select is_enabled
    into v_company_gateway_enabled
    from public.payment_gateways
   where owner_type = 'company'
     and company_id = p_company_id
     and provider = p_provider
     and mode = p_mode
     and deleted_at is null;

  select is_enabled_by_tenant and accepts_payments
    into v_tenant_enabled
    from public.gateway_availability
   where company_id = p_company_id
     and provider = p_provider;

  -- A tenant that has not expressed a preference inherits the platform state.
  return coalesce(v_company_gateway_enabled, v_platform_enabled, false)
         and coalesce(v_tenant_enabled, true);
end;
$$;

comment on function public.is_gateway_available(uuid, public.gateway_provider, public.gateway_mode) is
  'Returns true when both the platform and the tenant allow this provider.';
