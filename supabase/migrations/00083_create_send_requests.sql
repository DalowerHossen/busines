-- supabase/migrations/00083_create_send_requests.sql
-- Who may press send, and how a hundred invoices go out at once.
--
-- Only the owner of a tenant may send a message to a client. Staff prepare the
-- document and raise a request, which the owner approves or declines. Batch
-- sending exists so that approval does not become a hundred clicks.

create table public.send_requests (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,

  document_kind public.shared_document_type not null,
  document_id uuid not null,
  template_key text not null default 'invoice_sent',

  recipient_email citext not null,
  recipient_name text,
  cc_emails text[] not null default array[]::text[],
  custom_message text,

  status public.approval_status not null default 'pending',
  requested_by uuid not null,
  requested_at timestamptz not null default now(),

  reviewed_by uuid,
  reviewed_at timestamptz,
  decline_reason text,

  message_id uuid,
  sent_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint send_requests_email_check
    check (public.is_valid_email(recipient_email::text)),
  constraint send_requests_message_check
    check (custom_message is null or length(custom_message) <= 2000),
  constraint send_requests_declined_check
    check (status <> 'rejected' or decline_reason is not null),
  constraint send_requests_reviewed_check
    check (status = 'pending' or reviewed_at is not null)
);

comment on table public.send_requests is
  'A staff request for the owner to send a document to a client.';

create index send_requests_company_idx
  on public.send_requests (company_id, status, requested_at desc);

create index send_requests_pending_idx
  on public.send_requests (company_id, requested_at)
  where status = 'pending';

create index send_requests_document_idx
  on public.send_requests (document_kind, document_id);

-- -----------------------------------------------------------------------------
-- Batch sending
-- -----------------------------------------------------------------------------

create table public.send_batches (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,

  name text not null,
  document_kind public.shared_document_type not null,
  template_key text not null default 'invoice_sent',

  status public.job_status not null default 'queued',
  total_count integer not null default 0,
  queued_count integer not null default 0,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  skipped_count integer not null default 0,

  started_at timestamptz,
  completed_at timestamptz,
  -- Set when the owner stops a run that is already moving.
  cancelled_at timestamptz,
  cancelled_by uuid,

  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint send_batches_name_check
    check (length(btrim(name)) between 2 and 120),
  constraint send_batches_counts_check
    check (total_count >= 0 and queued_count >= 0 and sent_count >= 0
           and failed_count >= 0 and skipped_count >= 0
           and sent_count + failed_count + skipped_count + queued_count <= total_count)
);

comment on table public.send_batches is
  'One bulk send run, with the counts the summary dashboard reports.';

create index send_batches_company_idx
  on public.send_batches (company_id, created_at desc);

create table public.send_batch_items (
  id uuid primary key default public.generate_uuid_v7(),
  batch_id uuid not null,
  company_id uuid not null,

  document_id uuid not null,
  recipient_email citext,
  status text not null default 'queued',
  message_id uuid,
  skip_reason text,
  failure_reason text,

  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint send_batch_items_status_check
    check (status in ('queued', 'sent', 'failed', 'skipped')),
  constraint send_batch_items_email_check
    check (recipient_email is null or public.is_valid_email(recipient_email::text)),
  constraint send_batch_items_skip_check
    check (status <> 'skipped' or skip_reason is not null)
);

comment on table public.send_batch_items is
  'One document inside a bulk send, and what happened to it.';

create unique index send_batch_items_unique
  on public.send_batch_items (batch_id, document_id);

create index send_batch_items_batch_idx
  on public.send_batch_items (batch_id, status);

-- -----------------------------------------------------------------------------
-- Permission
-- -----------------------------------------------------------------------------

-- Returns true when the caller may send mail to a client of this tenant.
create or replace function public.can_send_client_email(p_company_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  -- The scheduled workers run without a signed in person, and they only ever
  -- send what an owner already approved.
  return public.is_service_role()
         or public.is_super_admin()
         or public.is_company_owner(p_company_id);
end;
$$;

comment on function public.can_send_client_email(uuid) is
  'Only the account owner, or the platform team, may write to a client.';
