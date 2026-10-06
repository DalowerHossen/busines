-- supabase/migrations/00128_create_outbound_webhooks.sql
-- Webhooks the platform sends out to tenant systems.
--
-- Delivery is a queue, not a side effect of the request that caused the
-- event: the tenant endpoint being slow or down must never slow down an
-- invoice being issued. Attempts back off, and anything that cannot be
-- delivered ends in a dead letter queue a person can replay.

create table public.webhook_endpoints (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,

  name text not null,
  target_url text not null,
  description text,

  -- The signing secret, encrypted at rest like every other secret.
  signing_secret_encrypted text not null,
  signing_secret_fingerprint text,
  secret_key_version smallint not null default 1,
  -- A rotation keeps the previous secret valid briefly, so a receiver can
  -- accept both while it redeploys.
  previous_secret_encrypted text,
  previous_secret_valid_until timestamptz,

  subscribed_events text[] not null default array['invoice.paid'],
  is_active boolean not null default true,
  api_version text not null default '2026-01-01',

  -- Delivery policy.
  max_attempts smallint not null default 6,
  timeout_seconds smallint not null default 10,

  -- Health, so the settings screen can be honest about a broken endpoint.
  consecutive_failures smallint not null default 0,
  disabled_at timestamptz,
  disabled_reason text,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  last_status_code smallint,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint webhook_endpoints_name_check
    check (length(btrim(name)) between 2 and 80),
  -- Plain HTTP would leak the payload, so it is not accepted.
  constraint webhook_endpoints_url_check
    check (target_url ~ '^https://[a-zA-Z0-9]'),
  constraint webhook_endpoints_events_check
    check (array_length(subscribed_events, 1) between 1 and 60),
  constraint webhook_endpoints_attempts_check
    check (max_attempts between 1 and 12),
  constraint webhook_endpoints_timeout_check
    check (timeout_seconds between 1 and 30),
  constraint webhook_endpoints_fingerprint_check
    check (signing_secret_fingerprint is null
           or signing_secret_fingerprint ~ '^[0-9a-f]{64}$'),
  constraint webhook_endpoints_disabled_check
    check (disabled_at is null or disabled_reason is not null)
);

comment on table public.webhook_endpoints is
  'A tenant system that wants to be told when something happens.';

create index webhook_endpoints_company_idx
  on public.webhook_endpoints (company_id)
  where deleted_at is null;

create index webhook_endpoints_active_idx
  on public.webhook_endpoints (company_id)
  where is_active and disabled_at is null and deleted_at is null;

-- -----------------------------------------------------------------------------
-- What happened
-- -----------------------------------------------------------------------------

create table public.outbound_events (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,

  event_type text not null,
  -- Stable identifier of the thing the event is about.
  resource_type text not null,
  resource_id uuid,
  payload jsonb not null default '{}'::jsonb,
  api_version text not null default '2026-01-01',

  -- Set by the producer so a retried action does not raise the event twice.
  idempotency_key text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  constraint outbound_events_type_check
    check (event_type ~ '^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$'),
  constraint outbound_events_payload_check
    check (jsonb_typeof(payload) = 'object')
);

comment on table public.outbound_events is
  'Something worth telling a tenant system about, raised once.';

create unique index outbound_events_idempotency_key
  on public.outbound_events (company_id, idempotency_key)
  where idempotency_key is not null;

create index outbound_events_company_idx
  on public.outbound_events (company_id, occurred_at desc);

create index outbound_events_resource_idx
  on public.outbound_events (resource_type, resource_id)
  where resource_id is not null;

-- -----------------------------------------------------------------------------
-- Delivering it
-- -----------------------------------------------------------------------------

create table public.webhook_deliveries (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  endpoint_id uuid not null,
  event_id uuid not null,

  status public.webhook_delivery_status not null default 'pending',
  attempt_count smallint not null default 0,
  max_attempts smallint not null default 6,
  next_attempt_at timestamptz not null default now(),

  -- Set while a worker holds the row, so two workers never send the same one.
  reserved_at timestamptz,
  reserved_by text,

  last_attempted_at timestamptz,
  last_status_code smallint,
  last_error text,
  last_duration_ms integer,
  response_excerpt text,

  delivered_at timestamptz,
  dead_lettered_at timestamptz,
  replayed_from_id uuid,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint webhook_deliveries_attempts_check
    check (attempt_count >= 0 and max_attempts between 1 and 12),
  constraint webhook_deliveries_delivered_check
    check (status <> 'delivered' or delivered_at is not null),
  constraint webhook_deliveries_exhausted_check
    check (status <> 'exhausted' or dead_lettered_at is not null)
);

comment on table public.webhook_deliveries is
  'One attempt chain to get one event to one endpoint.';

create unique index webhook_deliveries_unique
  on public.webhook_deliveries (endpoint_id, event_id)
  where replayed_from_id is null;

-- The worker reads exactly this index.
create index webhook_deliveries_due_idx
  on public.webhook_deliveries (next_attempt_at)
  where status = 'pending' and reserved_at is null;

create index webhook_deliveries_company_idx
  on public.webhook_deliveries (company_id, created_at desc);

create index webhook_deliveries_dead_idx
  on public.webhook_deliveries (company_id, dead_lettered_at desc)
  where status = 'exhausted';
