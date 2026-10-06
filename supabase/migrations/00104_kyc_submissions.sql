-- supabase/migrations/00104_kyc_submissions.sql
-- A manual KYC review submission. The company KYC status is updated by a
-- later review action; document files themselves live in Google Drive.

create table public.kyc_submissions (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  status kyc_status not null default 'pending_review',
  submitted_by_user_id uuid not null references public.users (id),
  reviewed_by_user_id uuid null references public.users (id),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz null,
  rejection_reason text null,
  reviewer_notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint kyc_submissions_review_fields_valid check (
    (status in ('approved', 'rejected') and reviewed_by_user_id is not null and reviewed_at is not null)
    or status in ('not_started', 'pending_review')
  )
);

create unique index kyc_submissions_one_open_per_company_key
  on public.kyc_submissions (company_id)
  where status = 'pending_review' and deleted_at is null;
create index kyc_submissions_company_status_idx
  on public.kyc_submissions (company_id, status, created_at desc)
  where deleted_at is null;
create index kyc_submissions_reviewer_idx
  on public.kyc_submissions (status, created_at)
  where status = 'pending_review' and deleted_at is null;

comment on table public.kyc_submissions is
  'A manual KYC review submission for a tenant. No OCR or automatic approval is performed by the database.';
