-- supabase/migrations/00160_payee_tax_profiles.sql
-- Tax identity and withholding profile for a company receiving Merchant of
-- Record settlements. Full taxpayer identifiers are encrypted at rest.

create table public.payee_tax_profiles (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  document_type tax_identity_document_type not null,
  status tax_identity_status not null default 'not_started',
  legal_name text not null,
  disregarded_entity_name text null,
  entity_classification text null,
  tax_country_code text not null,
  permanent_address jsonb not null default '{}'::jsonb,
  mailing_address jsonb null,
  tin_encrypted text null,
  tin_last_four text null,
  foreign_tax_id_encrypted text null,
  giin_encrypted text null,
  treaty_country_code text null,
  treaty_article text null,
  treaty_rate numeric(7, 4) null,
  signed_at timestamptz null,
  valid_from timestamptz null,
  valid_until timestamptz null,
  backup_withholding_required boolean not null default false,
  backup_withholding_rate numeric(7, 4) not null default 24,
  validation_errors jsonb not null default '[]'::jsonb,
  source_document_file_id text null,
  source_document_sha256 text null,
  supersedes_profile_id uuid null references public.payee_tax_profiles (id),
  change_reason text null,
  submitted_by_user_id uuid null references public.users (id),
  reviewed_by_user_id uuid null references public.users (id),
  reviewed_at timestamptz null,
  rejection_reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint payee_tax_profiles_name_not_blank check (length(btrim(legal_name)) > 0),
  constraint payee_tax_profiles_country_valid check (tax_country_code ~ '^[A-Z]{2}$'),
  constraint payee_tax_profiles_tin_last_four_valid check (
    tin_last_four is null or tin_last_four ~ '^[0-9A-Za-z]{2,4}$'
  ),
  constraint payee_tax_profiles_treaty_rate_valid check (
    treaty_rate is null or treaty_rate between 0 and 100
  ),
  constraint payee_tax_profiles_withholding_rate_valid check (
    backup_withholding_rate between 0 and 100
  ),
  constraint payee_tax_profiles_change_reason_valid check (
    supersedes_profile_id is null or change_reason is not null
  ),
  constraint payee_tax_profiles_signed_fields_valid check (
    (status in ('submitted', 'verified', 'rejected', 'expired') and signed_at is not null)
    or status = 'not_started'
  ),
  constraint payee_tax_profiles_validity_window_valid check (
    valid_until is null or valid_from is null or valid_until > valid_from
  )
);

create unique index payee_tax_profiles_one_current_key
  on public.payee_tax_profiles (company_id)
  where deleted_at is null and status in ('submitted', 'verified');
create index payee_tax_profiles_status_idx
  on public.payee_tax_profiles (status, valid_until)
  where deleted_at is null;

comment on table public.payee_tax_profiles is
  'Encrypted tax identity and withholding documentation for a settlement payee. The form source file is metadata only.';
