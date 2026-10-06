-- supabase/migrations/00099_ecommerce_sync_logs.sql
-- Operational log for imports, exports, invoice creation, and other
-- connector work. Failed work is retained with retry metadata.

create table public.ecommerce_sync_logs (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  connection_id uuid not null references public.ecommerce_connections (id),
  operation text not null,
  entity_type text not null,
  external_entity_id text null,
  entity_id uuid null,
  status ecommerce_sync_status not null default 'queued',
  attempt_count integer not null default 0,
  request_payload jsonb null,
  response_payload jsonb null,
  error_code text null,
  error_message text null,
  next_retry_at timestamptz null,
  started_at timestamptz null,
  finished_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ecommerce_sync_logs_operation_not_blank check (length(btrim(operation)) > 0),
  constraint ecommerce_sync_logs_entity_type_not_blank check (length(btrim(entity_type)) > 0),
  constraint ecommerce_sync_logs_attempt_count_non_negative check (attempt_count >= 0),
  constraint ecommerce_sync_logs_request_payload_object check (
    request_payload is null or jsonb_typeof(request_payload) = 'object'
  ),
  constraint ecommerce_sync_logs_response_payload_object check (
    response_payload is null or jsonb_typeof(response_payload) = 'object'
  )
);

create index ecommerce_sync_logs_queue_idx
  on public.ecommerce_sync_logs (company_id, status, next_retry_at)
  where status in ('queued', 'retrying', 'failed');
create index ecommerce_sync_logs_connection_id_idx
  on public.ecommerce_sync_logs (connection_id, created_at desc);
create index ecommerce_sync_logs_external_entity_idx
  on public.ecommerce_sync_logs (connection_id, entity_type, external_entity_id)
  where external_entity_id is not null;

comment on table public.ecommerce_sync_logs is
  'Retryable operational history for external-store synchronisation work.';
