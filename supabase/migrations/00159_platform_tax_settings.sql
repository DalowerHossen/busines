-- supabase/migrations/00159_platform_tax_settings.sql
-- Super-admin-controlled tax policy. Sensitive filer identifiers are
-- ciphertext only; encryption and decryption happen in trusted server code.

create table public.platform_tax_compliance_settings (
  id uuid primary key default extensions.gen_random_uuid(),
  singleton_key boolean not null default true,
  legal_name text not null,
  legal_entity_type text not null,
  tax_country_code text not null default 'US',
  business_address jsonb not null default '{}'::jsonb,
  federal_ein_encrypted text null,
  irs_tcc_encrypted text null,
  tax_year smallint not null,
  tpso_threshold_amount numeric(18, 2) not null default 20000,
  tpso_threshold_transactions integer not null default 200,
  information_return_threshold numeric(18, 2) not null default 2000,
  misc_thresholds jsonb not null default '{}'::jsonb,
  nec_exempt_entity_classifications text[] not null default '{}',
  misc_exempt_entity_classifications jsonb not null default '{}'::jsonb,
  backup_withholding_rate numeric(7, 4) not null default 24,
  federal_filing_deadlines jsonb not null default '{}'::jsonb,
  sales_tax_collection_enabled boolean not null default true,
  marketplace_facilitator_mode boolean not null default true,
  default_tax_policy_version text not null default 'us-2026-01',
  source_snapshot jsonb not null default '{}'::jsonb,
  effective_from timestamptz not null default now(),
  updated_by_user_id uuid null references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_tax_settings_singleton check (singleton_key),
  constraint platform_tax_settings_legal_name_not_blank check (length(btrim(legal_name)) > 0),
  constraint platform_tax_settings_entity_type_not_blank check (length(btrim(legal_entity_type)) > 0),
  constraint platform_tax_settings_country_valid check (tax_country_code ~ '^[A-Z]{2}$'),
  constraint platform_tax_settings_year_valid check (tax_year between 2020 and 2200),
  constraint platform_tax_settings_tps_threshold_valid check (
    tpso_threshold_amount >= 0 and tpso_threshold_transactions >= 0
  ),
  constraint platform_tax_settings_return_threshold_valid check (information_return_threshold >= 0),
  constraint platform_tax_settings_backup_rate_valid check (backup_withholding_rate between 0 and 100)
);

create unique index platform_tax_settings_singleton_key
  on public.platform_tax_compliance_settings (singleton_key);

create table public.tax_jurisdiction_rules (
  id uuid primary key default extensions.gen_random_uuid(),
  jurisdiction_code text not null,
  tax_type text not null default 'sales_use_tax',
  jurisdiction_name text not null,
  collection_required boolean not null default false,
  marketplace_facilitator_collection_required boolean not null default false,
  economic_nexus_amount numeric(18, 2) null,
  economic_nexus_transactions integer null,
  registration_required boolean not null default false,
  tax_rate numeric(9, 6) not null default 0,
  remittance_required boolean not null default false,
  seller_reporting_required boolean not null default false,
  customer_notice_required boolean not null default false,
  filing_frequency text null,
  filing_due_rule text null,
  source_url text not null,
  source_version text not null,
  source_retrieved_at timestamptz not null,
  reviewed_at timestamptz null,
  effective_from timestamptz not null,
  effective_until timestamptz null,
  rule_payload jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_by_user_id uuid null references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tax_jurisdiction_rules_code_valid check (jurisdiction_code ~ '^[A-Z]{2}(-[A-Z0-9]{1,6})?$'),
  constraint tax_jurisdiction_rules_name_not_blank check (length(btrim(jurisdiction_name)) > 0),
  constraint tax_jurisdiction_rules_source_https check (source_url like 'https://%'),
  constraint tax_jurisdiction_rules_version_not_blank check (length(btrim(source_version)) > 0),
  constraint tax_jurisdiction_rules_rate_valid check (tax_rate between 0 and 100),
  constraint tax_jurisdiction_rules_threshold_valid check (
    (economic_nexus_amount is null or economic_nexus_amount >= 0)
    and (economic_nexus_transactions is null or economic_nexus_transactions >= 0)
  ),
  constraint tax_jurisdiction_rules_window_valid check (
    effective_until is null or effective_until > effective_from
  )
);

create unique index tax_jurisdiction_rules_version_key
  on public.tax_jurisdiction_rules (jurisdiction_code, tax_type, effective_from);
create index tax_jurisdiction_rules_active_idx
  on public.tax_jurisdiction_rules (jurisdiction_code, tax_type, effective_from desc)
  where is_active = true;

comment on table public.platform_tax_compliance_settings is
  'One super-admin-controlled platform tax policy snapshot. Never stores plaintext EIN or IRS TCC values.';
comment on table public.tax_jurisdiction_rules is
  'Versioned, source-linked jurisdiction rules. Tax rates and collection duties are data, not hard-coded application constants.';
