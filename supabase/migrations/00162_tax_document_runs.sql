-- supabase/migrations/00162_tax_document_runs.sql
-- One-click annual U.S. information-return preparation. A run is a
-- versioned, reviewable snapshot; export and filing are separate steps.

create table public.tax_document_runs (
  id uuid primary key default extensions.gen_random_uuid(),
  tax_year smallint not null,
  revision_number integer not null default 1,
  status tax_document_run_status not null default 'draft',
  policy_version text not null,
  supersedes_run_id uuid null references public.tax_document_runs (id),
  correction_reason text null,
  policy_snapshot jsonb not null default '{}'::jsonb,
  filer_name text not null,
  filer_address jsonb not null default '{}'::jsonb,
  filer_tin_last_four text null,
  total_form_count integer not null default 0,
  validation_error_count integer not null default 0,
  csv_provider_file_id text null,
  report_provider_file_id text null,
  csv_sha256 text null,
  report_sha256 text null,
  generated_by_user_id uuid not null references public.users (id),
  generated_at timestamptz not null default now(),
  exported_at timestamptz null,
  filed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tax_document_runs_year_valid check (tax_year between 2020 and 2200),
  constraint tax_document_runs_revision_valid check (revision_number > 0),
  constraint tax_document_runs_correction_reason_valid check (
    supersedes_run_id is null or correction_reason is not null
  ),
  constraint tax_document_runs_filer_name_not_blank check (length(btrim(filer_name)) > 0),
  constraint tax_document_runs_counts_non_negative check (
    total_form_count >= 0 and validation_error_count >= 0
  ),
  constraint tax_document_runs_filer_tin_last_four_valid check (
    filer_tin_last_four is null or filer_tin_last_four ~ '^[0-9A-Za-z]{2,4}$'
  )
);

create unique index tax_document_runs_year_policy_revision_key
  on public.tax_document_runs (tax_year, policy_version, revision_number);
create index tax_document_runs_status_idx
  on public.tax_document_runs (tax_year, status, generated_at desc);

create table public.tax_document_rows (
  id uuid primary key default extensions.gen_random_uuid(),
  run_id uuid not null references public.tax_document_runs (id) on delete cascade,
  company_id uuid not null references public.companies (id),
  form_type tax_reporting_form not null,
  recipient_name text not null,
  recipient_address jsonb not null default '{}'::jsonb,
  recipient_tin_last_four text null,
  recipient_account_reference text not null,
  gross_amount numeric(18, 2) not null default 0,
  transaction_count integer not null default 0,
  federal_withholding_amount numeric(18, 2) not null default 0,
  boxes jsonb not null default '{}'::jsonb,
  is_reportable boolean not null default false,
  validation_errors jsonb not null default '[]'::jsonb,
  row_sha256 text not null,
  created_at timestamptz not null default now(),
  constraint tax_document_rows_name_not_blank check (length(btrim(recipient_name)) > 0),
  constraint tax_document_rows_reference_not_blank check (length(btrim(recipient_account_reference)) > 0),
  constraint tax_document_rows_amounts_non_negative check (
    gross_amount >= 0 and transaction_count >= 0 and federal_withholding_amount >= 0
  ),
  constraint tax_document_rows_tin_last_four_valid check (
    recipient_tin_last_four is null or recipient_tin_last_four ~ '^[0-9A-Za-z]{2,4}$'
  ),
  constraint tax_document_rows_hash_not_blank check (length(btrim(row_sha256)) > 0)
);

create unique index tax_document_rows_run_recipient_form_key
  on public.tax_document_rows (run_id, company_id, form_type);
create index tax_document_rows_run_reportable_idx
  on public.tax_document_rows (run_id, is_reportable, form_type);

create table public.tax_compliance_events (
  id uuid primary key default extensions.gen_random_uuid(),
  event_type tax_compliance_event_type not null,
  company_id uuid null references public.companies (id),
  run_id uuid null references public.tax_document_runs (id),
  actor_user_id uuid null references public.users (id),
  event_payload jsonb not null default '{}'::jsonb,
  previous_event_hash text null,
  event_hash text not null,
  created_at timestamptz not null default now(),
  constraint tax_compliance_events_hash_not_blank check (length(btrim(event_hash)) > 0)
);

create index tax_compliance_events_company_idx
  on public.tax_compliance_events (company_id, created_at desc)
  where company_id is not null;
create index tax_compliance_events_run_idx
  on public.tax_compliance_events (run_id, created_at desc)
  where run_id is not null;

comment on table public.tax_document_runs is
  'A versioned, one-click annual U.S. information-return preparation run. It prepares reviewable exports; it does not silently file with the IRS.';
comment on table public.tax_compliance_events is
  'Append-only tax compliance audit chain for settings, identity, registration, and information-return actions.';
