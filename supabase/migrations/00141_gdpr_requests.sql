-- supabase/migrations/00141_gdpr_requests.sql
-- GDPR export and deletion requests with a durable processing lifecycle.

create table public.gdpr_requests (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid null references public.companies (id),
  user_id uuid not null references public.users (id),
  request_type gdpr_request_type not null,
  status gdpr_request_status not null default 'requested',
  requested_at timestamptz not null default now(),
  due_at timestamptz null,
  started_at timestamptz null,
  completed_at timestamptz null,
  processed_by_user_id uuid null references public.users (id),
  export_provider_file_id text null,
  rejection_reason text null,
  processing_error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gdpr_requests_completed_fields_valid check (
    (status = 'completed' and completed_at is not null)
    or status <> 'completed'
  )
);

create unique index gdpr_requests_one_open_per_user_type_key
  on public.gdpr_requests (user_id, request_type)
  where status in ('requested', 'in_progress');
create index gdpr_requests_queue_idx
  on public.gdpr_requests (status, requested_at)
  where status in ('requested', 'in_progress');
create index gdpr_requests_company_idx
  on public.gdpr_requests (company_id, requested_at)
  where company_id is not null;

comment on table public.gdpr_requests is
  'A user data export or account deletion request with auditable processing state.';
