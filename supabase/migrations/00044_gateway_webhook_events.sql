-- supabase/migrations/00044_gateway_webhook_events.sql
-- A raw inbound webhook event from any gateway, persisted before
-- processing so delivery is idempotent and replayable. Deliberately NOT
-- tenant-scoped (no company_id): a webhook arrives before the platform
-- knows which company it belongs to -- processing logic looks that up via
-- gateway_transaction_id against the payments table -- matching the lean
-- GatewayWebhookEvent TS shape, which also carries no company_id.
-- `payload` is the verified, parsed JSON body; raw-body signature
-- verification happens in application code before this row is ever
-- written.

create table public.gateway_webhook_events (
  id uuid primary key default extensions.gen_random_uuid(),
  gateway gateway_id not null,
  event_type text not null,
  gateway_event_id text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz null,
  processing_error text null
);

-- The same gateway event must never be processed twice.
create unique index gateway_webhook_events_gateway_event_id_key
  on public.gateway_webhook_events (gateway, gateway_event_id);
create index gateway_webhook_events_unprocessed_idx
  on public.gateway_webhook_events (received_at)
  where processed_at is null;

comment on table public.gateway_webhook_events is
  'Raw inbound gateway webhook events, persisted before processing for idempotent, replayable handling. Platform-level, not tenant-scoped.';
