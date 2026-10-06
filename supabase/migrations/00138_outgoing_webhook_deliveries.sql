-- supabase/migrations/00138_outgoing_webhook_deliveries.sql
-- Outgoing webhook delivery queue and immutable attempt history.

create type outgoing_webhook_delivery_status as enum (
  'queued',
  'sending',
  'delivered',
  'failed',
  'dead_letter'
);

create table public.outgoing_webhook_deliveries (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  endpoint_id uuid not null references public.outgoing_webhook_endpoints (id) on delete cascade,
  event_type text not null,
  event_id uuid null,
  payload jsonb not null,
  status outgoing_webhook_delivery_status not null default 'queued',
  attempt_count integer not null default 0,
  next_attempt_at timestamptz null,
  response_status_code integer null,
  response_body text null,
  delivered_at timestamptz null,
  last_error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint outgoing_webhook_deliveries_event_type_not_blank check (length(btrim(event_type)) > 0),
  constraint outgoing_webhook_deliveries_payload_object check (jsonb_typeof(payload) = 'object'),
  constraint outgoing_webhook_deliveries_attempt_count_non_negative check (attempt_count >= 0),
  constraint outgoing_webhook_deliveries_response_status_valid check (
    response_status_code is null or response_status_code between 100 and 599
  )
);

create index outgoing_webhook_deliveries_queue_idx
  on public.outgoing_webhook_deliveries (company_id, status, next_attempt_at)
  where status in ('queued', 'sending', 'failed');
create index outgoing_webhook_deliveries_endpoint_time_idx
  on public.outgoing_webhook_deliveries (endpoint_id, created_at desc);
create index outgoing_webhook_deliveries_event_idx
  on public.outgoing_webhook_deliveries (event_type, event_id)
  where event_id is not null;

comment on table public.outgoing_webhook_deliveries is
  'A retryable signed webhook delivery record; dead-letter rows remain available for replay.';
