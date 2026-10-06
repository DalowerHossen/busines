-- supabase/migrations/00012_create_companies.sql
-- The tenant root. Every business record in the platform belongs to exactly
-- one company, and every policy is anchored on companies.id.

create table public.companies (
  id uuid primary key default public.generate_uuid_v7(),

  -- Set when the tenant was created by a white label reseller.
  reseller_id uuid,

  slug text not null,
  legal_name text not null,
  display_name text not null,
  status public.company_status not null default 'onboarding',

  -- Localisation and money formatting defaults.
  country_code char(2) not null default 'US',
  base_currency char(3) not null default 'USD',
  currency_exponent smallint not null default 2,
  time_zone text not null default 'UTC',
  date_format text not null default 'MM/dd/yyyy',
  fiscal_year_start_month smallint not null default 1,

  -- Document calculation defaults, copied onto every new document.
  tax_mode public.tax_mode not null default 'exclusive',
  discount_stage public.discount_stage not null default 'before_tax',
  rounding_mode public.rounding_mode not null default 'half_up',
  decimal_scale smallint not null default 2,

  industry text,
  company_size text,
  website text,

  -- Lifecycle timestamps.
  onboarding_completed_at timestamptz,
  trial_ends_at timestamptz,
  activated_at timestamptz,
  suspended_at timestamptz,
  suspension_reason text,
  closed_at timestamptz,

  -- Merchant of record state.
  kyc_status public.kyc_status not null default 'not_started',
  mor_enabled boolean not null default false,
  mor_enabled_at timestamptz,
  risk_level public.risk_level not null default 'low',

  -- Resource usage, enforced against the subscribed plan.
  storage_quota_bytes bigint not null default 1073741824,
  storage_used_bytes bigint not null default 0,

  settings jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint companies_slug_format_check
    check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'),
  constraint companies_country_code_check
    check (country_code ~ '^[A-Z]{2}$'),
  constraint companies_base_currency_check
    check (base_currency ~ '^[A-Z]{3}$'),
  constraint companies_currency_exponent_check
    check (currency_exponent between 0 and 4),
  constraint companies_fiscal_month_check
    check (fiscal_year_start_month between 1 and 12),
  constraint companies_decimal_scale_check
    check (decimal_scale between 0 and 4),
  constraint companies_storage_quota_check
    check (storage_quota_bytes > 0 and storage_used_bytes >= 0),
  constraint companies_legal_name_check
    check (length(btrim(legal_name)) between 2 and 200),
  constraint companies_display_name_check
    check (length(btrim(display_name)) between 2 and 120),
  constraint companies_suspension_reason_check
    check (suspended_at is null or suspension_reason is not null)
);

comment on table public.companies is
  'Tenant root record. Every business table references companies.id.';
comment on column public.companies.reseller_id is
  'White label partner that created and bills this tenant, when applicable.';
comment on column public.companies.mor_enabled is
  'True only after KYC verification, allowing use of the platform merchant account.';

-- A slug is unique among live tenants; closed tenants release their slug.
create unique index companies_slug_unique
  on public.companies (slug)
  where deleted_at is null;

create index companies_status_idx
  on public.companies (status)
  where deleted_at is null;

create index companies_reseller_idx
  on public.companies (reseller_id)
  where deleted_at is null and reseller_id is not null;

create index companies_kyc_status_idx
  on public.companies (kyc_status)
  where deleted_at is null;

create index companies_created_at_idx
  on public.companies (created_at desc, id desc)
  where deleted_at is null;

create index companies_display_name_trgm_idx
  on public.companies using gin (display_name extensions.gin_trgm_ops);
