-- supabase/migrations/00088_message_delivery_events.sql
-- Provider callbacks for sent, delivered, read, or failed message states.
-- The raw event is retained for idempotent processing and auditability.

create table public.message_delivery_events (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  message_delivery_id uuid not null references public.message_deliveries (id) on delete cascade,
  channel communication_channel not null,
  provider_event_id text not null,
  event_type text not null,
  payload jsonb not null,
  occurred_at timestamptz null,
  received_at timestamptz not null default now(),
  processed_at timestamptz null,
  processing_error text null,
  constraint message_delivery_events_channel_valid check (channel <> 'in_app'),
  constraint message_delivery_events_event_type_not_blank check (length(btrim(event_type)) > 0),
  constraint message_delivery_events_payload_object check (jsonb_typeof(payload) = 'object')
);

create unique index message_delivery_events_channel_provider_id_key
  on public.message_delivery_events (channel, provider_event_id);
create index message_delivery_events_message_id_idx
  on public.message_delivery_events (message_delivery_id, received_at desc);
create index message_delivery_events_unprocessed_idx
  on public.message_delivery_events (received_at)
  where processed_at is null;
create index message_delivery_events_company_id_idx
  on public.message_delivery_events (company_id, received_at desc);

comment on table public.message_delivery_events is
  'A raw provider delivery callback retained for idempotent message-status processing.';
