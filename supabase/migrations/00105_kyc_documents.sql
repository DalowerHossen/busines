-- supabase/migrations/00105_kyc_documents.sql
-- KYC document metadata. Binary content is stored by the configured storage
-- provider; Supabase stores only the provider reference and validation data.

create table public.kyc_documents (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  submission_id uuid not null references public.kyc_submissions (id) on delete cascade,
  document_type kyc_document_type not null,
  review_status kyc_document_status not null default 'pending',
  provider_file_id text not null,
  original_file_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  content_sha256 text null,
  uploaded_by_user_id uuid not null references public.users (id),
  reviewed_by_user_id uuid null references public.users (id),
  reviewed_at timestamptz null,
  rejection_reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint kyc_documents_provider_file_not_blank check (length(btrim(provider_file_id)) > 0),
  constraint kyc_documents_file_name_not_blank check (length(btrim(original_file_name)) > 0),
  constraint kyc_documents_mime_type_allowed check (
    mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')
  ),
  constraint kyc_documents_size_limit check (size_bytes > 0 and size_bytes <= 5242880),
  constraint kyc_documents_review_fields_valid check (
    (review_status in ('accepted', 'rejected') and reviewed_by_user_id is not null and reviewed_at is not null)
    or review_status = 'pending'
  )
);

create unique index kyc_documents_submission_type_key
  on public.kyc_documents (submission_id, document_type)
  where deleted_at is null;
create index kyc_documents_company_status_idx
  on public.kyc_documents (company_id, review_status)
  where deleted_at is null;
create index kyc_documents_submission_id_idx
  on public.kyc_documents (submission_id)
  where deleted_at is null;

comment on table public.kyc_documents is
  'Validated KYC file metadata. The 5MB limit and image/PDF allowlist are enforced before storage.';
