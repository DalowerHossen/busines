-- supabase/migrations/00079_create_messages.sql
-- The outbox and the delivery log.
--
-- Every message the platform sends is a row here before it reaches a provider,
-- which gives three things at once: a queue the workers drain, an audit trail
-- of what a client was told, and the evidence needed when a payment is
-- disputed.

create table public.messages (
  id uuid primary key default public.generate_uuid_v7(),

  -- Null for platform mail that belongs to no tenant.
  company_id uuid,

  channel public.message_channel not null default 'email',
  status public.message_status not null default 'queued',
  template_key text,
  notification_kind public.notification_type,

  sender_identity_id uuid,
  from_name text,
  from_email citext,
  reply_to_email citext,

  to_email citext,
  to_phone text,
  to_name text,
  cc_emails text[] not null default array[]::text[],
  bcc_emails text[] not null default array[]::text[],

  subject text,
  body_html text,
  body_text text,
  attachments jsonb not null default '[]'::jsonb,

  -- What the message is about, so the document timeline can show it.
  related_entity_type text,
  related_entity_id uuid,
  client_id uuid,

  -- Stops a retried worker from sending the same message twice.
  idempotency_key text not null,

  scheduled_for timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  first_opened_at timestamptz,
  last_opened_at timestamptz,
  open_count integer not null default 0,
  click_count integer not null default 0,

  failed_at timestamptz,
  failure_reason text,
  attempt_count smallint not null default 0,
  next_attempt_at timestamptz,

  provider text,
  provider_message_id text,

  requested_by uuid,
  approved_by uuid,
  batch_id uuid,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint messages_recipient_check
    check (
      (channel = 'email' and to_email is not null)
      or (channel in ('sms', 'whatsapp', 'viber') and to_phone is not null)
      or channel in ('telegram', 'in_app')
    ),
  constraint messages_email_check
    check (to_email is null or public.is_valid_email(to_email::text)),
  constraint messages_subject_check
    check (channel <> 'email' or length(btrim(coalesce(subject, ''))) > 0),
  constraint messages_attachments_check
    check (jsonb_typeof(attachments) = 'array'),
  constraint messages_attempts_check
    check (attempt_count between 0 and 25),
  constraint messages_counts_check
    check (open_count >= 0 and click_count >= 0),
  constraint messages_idempotency_check
    check (length(btrim(idempotency_key)) between 8 and 160),
  constraint messages_failure_check
    check (status <> 'failed' or failure_reason is not null)
);

comment on table public.messages is
  'Every message queued, sent or refused, with its delivery outcome.';
comment on column public.messages.idempotency_key is
  'Natural key of the send; a repeated worker run reuses the existing row.';

create unique index messages_idempotency_unique
  on public.messages (idempotency_key);

create index messages_company_idx
  on public.messages (company_id, created_at desc);

create index messages_status_idx
  on public.messages (status, coalesce(scheduled_for, created_at))
  where status in ('queued', 'scheduled');

create index messages_retry_idx
  on public.messages (next_attempt_at)
  where status = 'failed' and next_attempt_at is not null;

create index messages_entity_idx
  on public.messages (related_entity_type, related_entity_id, created_at desc);

create index messages_recipient_idx
  on public.messages (to_email, created_at desc);

create index messages_batch_idx
  on public.messages (batch_id)
  where batch_id is not null;

-- -----------------------------------------------------------------------------
-- Delivery events
-- -----------------------------------------------------------------------------

-- Provider callbacks land here untouched. The message row carries the current
-- state; this table explains how it got there.
create table public.message_events (
  id uuid primary key default public.generate_uuid_v7(),
  message_id uuid not null,
  company_id uuid,

  event_type public.message_status not null,
  provider_event_id text,
  detail jsonb not null default '{}'::jsonb,

  ip_address inet,
  user_agent text,
  clicked_url text,

  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  constraint message_events_detail_check
    check (jsonb_typeof(detail) = 'object')
);

comment on table public.message_events is
  'Raw delivery, open, click and bounce callbacks for a message.';

create index message_events_message_idx
  on public.message_events (message_id, occurred_at desc);

create unique index message_events_provider_unique
  on public.message_events (provider_event_id)
  where provider_event_id is not null;

create trigger message_events_append_only
  before update or delete on public.message_events
  for each row execute function public.block_audit_mutation();
