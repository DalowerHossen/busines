-- supabase/migrations/00098_ecommerce_webhook_events.sql
-- Raw order/product webhooks are persisted before processing. The unique
-- connection and provider-event key prevents duplicate order synchronisation.

create table public.ecommerce_webhook_events (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  connection_id uuid not null references public.ecommerce_connections (id),
  platform ecommerce_platform not null,
  provider_event_id text not null,
  topic text not null,
  payload jsonb not null,
  signature_verified boolean not null default false,
  status ecommerce_webhook_status not null default 'received',
  related_order_id uuid null references public.ecommerce_orders (id),
  received_at timestamptz not null default now(),
  processed_at timestamptz null,
  attempt_count integer not null default 0,
  next_attempt_at timestamptz null,
  processing_error text null,
  constraint ecommerce_webhook_events_provider_id_not_blank check (
    length(btrim(provider_event_id)) > 0
  ),
  constraint ecommerce_webhook_events_topic_not_blank check (length(btrim(topic)) > 0),
  constraint ecommerce_webhook_events_payload_object check (jsonb_typeof(payload) = 'object'),
  constraint ecommerce_webhook_events_attempt_count_non_negative check (attempt_count >= 0)
);

create unique index ecommerce_webhook_events_connection_provider_id_key
  on public.ecommerce_webhook_events (connection_id, provider_event_id);
create index ecommerce_webhook_events_unprocessed_idx
  on public.ecommerce_webhook_events (received_at)
  where status in ('received', 'processing', 'failed');
create index ecommerce_webhook_events_company_id_idx
  on public.ecommerce_webhook_events (company_id, received_at desc);
create index ecommerce_webhook_events_order_id_idx
  on public.ecommerce_webhook_events (related_order_id)
  where related_order_id is not null;

comment on table public.ecommerce_webhook_events is
  'An idempotent raw store webhook event retained for order synchronisation and retry processing.';
