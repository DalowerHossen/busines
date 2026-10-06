-- supabase/migrations/00113_mor_agreements.sql
-- A versioned Merchant of Record agreement. Activation is permitted only
-- after manual KYC approval and terms acceptance in application logic.

create table public.mor_agreements (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  agreement_version text not null,
  status mor_agreement_status not null default 'pending',
  fee_rule_id uuid not null references public.platform_fee_rules (id),
  platform_gateway gateway_id not null,
  accepted_by_user_id uuid null references public.users (id),
  accepted_at timestamptz null,
  kyc_approved_at timestamptz null,
  effective_from timestamptz null,
  effective_until timestamptz null,
  terms_snapshot_hash text not null,
  termination_reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint mor_agreements_version_not_blank check (length(btrim(agreement_version)) > 0),
  constraint mor_agreements_terms_hash_not_blank check (length(btrim(terms_snapshot_hash)) > 0),
  constraint mor_agreements_acceptance_fields_valid check (
    (status in ('active', 'suspended', 'terminated', 'expired')
      and accepted_by_user_id is not null and accepted_at is not null)
    or status = 'pending'
  ),
  constraint mor_agreements_effective_window_valid check (
    effective_until is null or effective_from is null or effective_until > effective_from
  )
);

create unique index mor_agreements_company_version_key
  on public.mor_agreements (company_id, agreement_version)
  where deleted_at is null;
create unique index mor_agreements_one_active_key
  on public.mor_agreements (company_id)
  where status = 'active' and deleted_at is null;
create index mor_agreements_status_idx
  on public.mor_agreements (company_id, status)
  where deleted_at is null;

comment on table public.mor_agreements is
  'A versioned, terms-accepted Merchant of Record agreement gated by manual KYC approval.';
