-- supabase/migrations/00092_communication_webhook_events.sql
-- Raw inbound webhook events from communication providers. The company is
-- nullable because provider verification and tenant lookup may happen in
-- separate processing steps.

create table public.communication_webhook_events (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid null references public.companies (id),
  channel communication_channel not null,
  provider_event_id text not null,
  event_type text not null,
  payload jsonb not null,
  signature_verified boolean not null default false,
  received_at timestamptz not null default now(),
  processed_at timestamptz null,
  processing_error text null,
  constraint communication_webhook_events_channel_valid check (channel <> 'in_app'),
  constraint communication_webhook_events_event_type_not_blank check (length(btrim(event_type)) > 0),
  constraint communication_webhook_events_payload_object check (jsonb_typeof(payload) = 'object')
);

create unique index communication_webhook_events_channel_provider_id_key
  on public.communication_webhook_events (channel, provider_event_id);
create index communication_webhook_events_unprocessed_idx
  on public.communication_webhook_events (received_at)
  where processed_at is null;
create index communication_webhook_events_company_id_idx
  on public.communication_webhook_events (company_id, received_at desc)
  where company_id is not null;

comment on table public.communication_webhook_events is
  'A raw inbound WhatsApp, SMS, Telegram, Viber, or email provider webhook retained for verification and replay.';
