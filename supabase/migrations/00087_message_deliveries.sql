-- supabase/migrations/00087_message_deliveries.sql
-- Outbound message queue and delivery history. Content is snapshotted at
-- enqueue time so later template edits cannot change historical evidence.

create table public.message_deliveries (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  channel communication_channel not null,
  direction message_direction not null default 'outbound',
  status message_status not null default 'queued',
  notification_id uuid null references public.notifications (id),
  client_id uuid null references public.clients (id),
  recipient_user_id uuid null references public.users (id),
  email_template_id uuid null references public.email_templates (id),
  whatsapp_template_id uuid null references public.whatsapp_templates (id),
  recipient_address text not null,
  subject_snapshot text null,
  content_snapshot text null,
  provider_message_id text null,
  provider_payload jsonb null,
  idempotency_key text null,
  retry_count integer not null default 0,
  next_retry_at timestamptz null,
  queued_at timestamptz not null default now(),
  sent_at timestamptz null,
  delivered_at timestamptz null,
  read_at timestamptz null,
  failed_at timestamptz null,
  failure_code text null,
  failure_reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint message_deliveries_channel_valid check (channel <> 'in_app'),
  constraint message_deliveries_recipient_not_blank check (length(btrim(recipient_address)) > 0),
  constraint message_deliveries_retry_count_non_negative check (retry_count >= 0),
  constraint message_deliveries_provider_payload_object check (
    provider_payload is null or jsonb_typeof(provider_payload) = 'object'
  )
);

create unique index message_deliveries_company_idempotency_key
  on public.message_deliveries (company_id, idempotency_key)
  where idempotency_key is not null and deleted_at is null;
create unique index message_deliveries_channel_provider_id_key
  on public.message_deliveries (channel, provider_message_id)
  where provider_message_id is not null;
create index message_deliveries_queue_idx
  on public.message_deliveries (company_id, queued_at)
  where status in ('queued', 'sending') and deleted_at is null;
create index message_deliveries_recipient_idx
  on public.message_deliveries (company_id, client_id, created_at desc)
  where client_id is not null and deleted_at is null;
create index message_deliveries_status_idx
  on public.message_deliveries (company_id, status, created_at desc)
  where deleted_at is null;

comment on table public.message_deliveries is
  'A queued or completed outbound communication with immutable content snapshots and provider delivery identifiers.';
