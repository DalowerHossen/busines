-- supabase/migrations/00056_create_webhook_events.sql
-- Incoming provider webhooks.
--
-- A webhook is written down before it is acted upon. The raw body is kept for
-- signature verification and replay, the provider event identifier makes the
-- handler idempotent, and anything that keeps failing lands in the dead letter
-- queue instead of being lost.

create table public.webhook_events (
  id uuid primary key default public.generate_uuid_v7(),

  provider public.gateway_provider not null,
  gateway_id uuid,
  company_id uuid,

  -- Identifier supplied by the provider. The unique index on it is what makes
  -- a redelivered webhook harmless.
  provider_event_id text not null,
  event_type text not null,
  api_version text,

  payload jsonb not null,
  payload_sha256 text not null,
  signature_header text,
  signature_verified boolean not null default false,

  status public.webhook_delivery_status not null default 'pending',
  attempt_count smallint not null default 0,
  max_attempts smallint not null default 8,
  next_attempt_at timestamptz,
  last_error text,

  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_duration_ms integer,

  -- Set when the event has been retried to exhaustion and needs a human.
  moved_to_dead_letter_at timestamptz,
  resolved_by uuid,
  resolution_note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint webhook_events_payload_check
    check (jsonb_typeof(payload) = 'object'),
  constraint webhook_events_hash_check
    check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  constraint webhook_events_attempts_check
    check (attempt_count >= 0 and max_attempts between 1 and 50),
  constraint webhook_events_type_check
    check (length(btrim(event_type)) between 1 and 120)
);

comment on table public.webhook_events is
  'Raw provider webhooks with their verification state and retry history.';
comment on column public.webhook_events.provider_event_id is
  'Provider identifier that makes repeated delivery of the same event safe.';

create unique index webhook_events_provider_event_unique
  on public.webhook_events (provider, provider_event_id);

create index webhook_events_status_idx
  on public.webhook_events (status, next_attempt_at);

create index webhook_events_company_idx
  on public.webhook_events (company_id, received_at desc)
  where company_id is not null;

create index webhook_events_dead_letter_idx
  on public.webhook_events (received_at desc)
  where moved_to_dead_letter_at is not null;

-- Records a webhook and reports whether it is new. A repeated delivery
-- returns false, which lets the handler stop immediately.
create or replace function public.register_webhook_event(
  p_provider public.gateway_provider,
  p_provider_event_id text,
  p_event_type text,
  p_payload jsonb,
  p_payload_sha256 text,
  p_signature_verified boolean default false,
  p_company_id uuid default null
)
returns table (event_id uuid, is_new boolean)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_existing uuid;
begin
  select id into v_existing
    from public.webhook_events
   where provider = p_provider
     and provider_event_id = p_provider_event_id;

  if v_existing is not null then
    return query select v_existing, false;
    return;
  end if;

  insert into public.webhook_events (
    provider, company_id, provider_event_id, event_type, payload,
    payload_sha256, signature_verified, status, next_attempt_at
  )
  values (
    p_provider, p_company_id, p_provider_event_id, p_event_type, p_payload,
    p_payload_sha256, p_signature_verified, 'pending', now()
  )
  returning id into v_id;

  return query select v_id, true;
end;
$$;

comment on function public.register_webhook_event(
  public.gateway_provider, text, text, jsonb, text, boolean, uuid
) is 'Stores a webhook once and reports whether this delivery is the first.';

-- Marks the outcome of a processing attempt and schedules the next retry with
-- an exponential backoff.
create or replace function public.complete_webhook_event(
  p_event_id uuid,
  p_succeeded boolean,
  p_error text default null,
  p_duration_ms integer default null
)
returns public.webhook_delivery_status
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_event public.webhook_events%rowtype;
  v_status public.webhook_delivery_status;
  v_attempts smallint;
begin
  select * into v_event from public.webhook_events where id = p_event_id for update;

  if not found then
    raise exception 'Webhook event % was not found', p_event_id using errcode = 'P0002';
  end if;

  v_attempts := v_event.attempt_count + 1;

  if p_succeeded then
    v_status := 'delivered';

    update public.webhook_events
       set status = v_status,
           attempt_count = v_attempts,
           processed_at = now(),
           processing_duration_ms = p_duration_ms,
           next_attempt_at = null,
           last_error = null,
           updated_at = now()
     where id = p_event_id;

    return v_status;
  end if;

  if v_attempts >= v_event.max_attempts then
    v_status := 'exhausted';

    update public.webhook_events
       set status = v_status,
           attempt_count = v_attempts,
           last_error = p_error,
           next_attempt_at = null,
           moved_to_dead_letter_at = now(),
           updated_at = now()
     where id = p_event_id;

    return v_status;
  end if;

  -- The event stays pending and is picked up again after the backoff window.
  v_status := 'pending';

  update public.webhook_events
     set status = v_status,
         attempt_count = v_attempts,
         last_error = p_error,
         next_attempt_at = now() + make_interval(secs => power(3, v_attempts)::integer),
         updated_at = now()
   where id = p_event_id;

  return v_status;
end;
$$;

comment on function public.complete_webhook_event(uuid, boolean, text, integer) is
  'Records the result of a webhook attempt and schedules the next retry.';
