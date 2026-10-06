-- supabase/migrations/00129_create_webhook_functions.sql
-- Raising events, delivering them, and dealing with the ones that fail.

-- Raises an event and queues it for every endpoint that asked for it.
-- Raising the same event twice with the same idempotency key is a no op,
-- which is what makes a retried action safe.
create or replace function public.emit_outbound_event(
  p_company_id uuid,
  p_event_type text,
  p_resource_type text,
  p_resource_id uuid,
  p_payload jsonb default '{}'::jsonb,
  p_idempotency_key text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_event_id uuid;
  v_endpoint record;
begin
  if p_idempotency_key is not null then
    select id into v_event_id
      from public.outbound_events
     where company_id = p_company_id
       and idempotency_key = p_idempotency_key;

    if v_event_id is not null then
      return v_event_id;
    end if;
  end if;

  insert into public.outbound_events (
    company_id, event_type, resource_type, resource_id, payload,
    idempotency_key
  )
  values (
    p_company_id, p_event_type, p_resource_type, p_resource_id,
    coalesce(p_payload, '{}'::jsonb), p_idempotency_key
  )
  returning id into v_event_id;

  for v_endpoint in
    select *
      from public.webhook_endpoints
     where company_id = p_company_id
       and is_active
       and disabled_at is null
       and deleted_at is null
       and (p_event_type = any (subscribed_events)
            or '*' = any (subscribed_events)
            or (split_part(p_event_type, '.', 1) || '.*') = any (subscribed_events))
  loop
    insert into public.webhook_deliveries (
      company_id, endpoint_id, event_id, max_attempts
    )
    values (p_company_id, v_endpoint.id, v_event_id, v_endpoint.max_attempts)
    on conflict do nothing;
  end loop;

  return v_event_id;
end;
$$;

comment on function public.emit_outbound_event(
  uuid, text, text, uuid, jsonb, text
) is 'Raises an event once and queues it for every subscribed endpoint.';

-- Hands a batch of due deliveries to one worker. Skip locked means several
-- workers can run at the same time without ever colliding.
create or replace function public.claim_webhook_deliveries(
  p_worker_id text,
  p_limit integer default 20
)
returns setof public.webhook_deliveries
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  with due as (
    select id
      from public.webhook_deliveries
     where status = 'pending'
       and reserved_at is null
       and next_attempt_at <= now()
     order by next_attempt_at
     limit greatest(coalesce(p_limit, 20), 1)
       for update skip locked
  )
  update public.webhook_deliveries as d
     set reserved_at = now(),
         reserved_by = p_worker_id,
         attempt_count = d.attempt_count + 1,
         last_attempted_at = now(),
         updated_at = now()
    from due
   where d.id = due.id
  returning d.*;
end;
$$;

comment on function public.claim_webhook_deliveries(text, integer) is
  'Reserves a batch of due deliveries for one worker.';

-- Records the result of one attempt. Success closes the chain; failure backs
-- off exponentially and, once the attempts are used up, dead letters.
create or replace function public.record_webhook_attempt(
  p_delivery_id uuid,
  p_status_code smallint,
  p_duration_ms integer default null,
  p_error text default null,
  p_response_excerpt text default null
)
returns public.webhook_delivery_status
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_delivery public.webhook_deliveries%rowtype;
  v_succeeded boolean;
  v_status public.webhook_delivery_status;
  v_backoff_seconds integer;
begin
  select * into v_delivery
    from public.webhook_deliveries
   where id = p_delivery_id for update;

  if not found then
    raise exception 'Delivery % was not found', p_delivery_id using errcode = 'P0002';
  end if;

  v_succeeded := p_status_code between 200 and 299;

  if v_succeeded then
    v_status := 'delivered';

    update public.webhook_deliveries
       set status = v_status,
           delivered_at = now(),
           reserved_at = null,
           reserved_by = null,
           last_status_code = p_status_code,
           last_duration_ms = p_duration_ms,
           last_error = null,
           response_excerpt = left(coalesce(p_response_excerpt, ''), 500),
           updated_at = now()
     where id = p_delivery_id;

    update public.webhook_endpoints
       set consecutive_failures = 0,
           last_success_at = now(),
           last_status_code = p_status_code,
           updated_at = now()
     where id = v_delivery.endpoint_id;

    return v_status;
  end if;

  if v_delivery.attempt_count >= v_delivery.max_attempts then
    v_status := 'exhausted';

    update public.webhook_deliveries
       set status = v_status,
           dead_lettered_at = now(),
           reserved_at = null,
           reserved_by = null,
           last_status_code = p_status_code,
           last_duration_ms = p_duration_ms,
           last_error = left(coalesce(p_error, 'The endpoint did not accept the event'), 500),
           response_excerpt = left(coalesce(p_response_excerpt, ''), 500),
           updated_at = now()
     where id = p_delivery_id;
  else
    v_status := 'pending';
    -- One minute, then doubling, capped at six hours.
    v_backoff_seconds := least(60 * power(2, v_delivery.attempt_count)::integer, 21600);

    update public.webhook_deliveries
       set status = v_status,
           next_attempt_at = now() + make_interval(secs => v_backoff_seconds),
           reserved_at = null,
           reserved_by = null,
           last_status_code = p_status_code,
           last_duration_ms = p_duration_ms,
           last_error = left(coalesce(p_error, 'The endpoint did not accept the event'), 500),
           response_excerpt = left(coalesce(p_response_excerpt, ''), 500),
           updated_at = now()
     where id = p_delivery_id;
  end if;

  update public.webhook_endpoints
     set consecutive_failures = consecutive_failures + 1,
         last_failure_at = now(),
         last_status_code = p_status_code,
         updated_at = now()
   where id = v_delivery.endpoint_id;

  -- An endpoint that has failed twenty times in a row is switched off rather
  -- than hammered, and the tenant is told why.
  update public.webhook_endpoints
     set disabled_at = now(),
         disabled_reason = 'Switched off after twenty failed deliveries in a row',
         is_active = false,
         updated_at = now()
   where id = v_delivery.endpoint_id
     and consecutive_failures >= 20
     and disabled_at is null;

  return v_status;
end;
$$;

comment on function public.record_webhook_attempt(
  uuid, smallint, integer, text, text
) is 'Records one delivery attempt and schedules the next one.';

-- Puts a dead lettered delivery back in the queue, as a new attempt chain.
create or replace function public.replay_webhook_delivery(p_delivery_id uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_delivery public.webhook_deliveries%rowtype;
  v_new_id uuid;
begin
  select * into v_delivery
    from public.webhook_deliveries
   where id = p_delivery_id;

  if not found then
    raise exception 'Delivery % was not found', p_delivery_id using errcode = 'P0002';
  end if;

  if not (public.is_service_role()
          or public.is_super_admin()
          or public.is_company_owner(v_delivery.company_id)) then
    raise exception 'Only the account owner can replay a webhook'
      using errcode = '42501';
  end if;

  if v_delivery.status <> 'exhausted' then
    raise exception 'Only a dead lettered delivery is replayed' using errcode = '22023';
  end if;

  insert into public.webhook_deliveries (
    company_id, endpoint_id, event_id, max_attempts, replayed_from_id
  )
  values (
    v_delivery.company_id, v_delivery.endpoint_id, v_delivery.event_id,
    v_delivery.max_attempts, p_delivery_id
  )
  returning id into v_new_id;

  -- A replay is also a vote of confidence in the endpoint, so it comes back.
  update public.webhook_endpoints
     set is_active = true,
         disabled_at = null,
         disabled_reason = null,
         consecutive_failures = 0,
         updated_at = now()
   where id = v_delivery.endpoint_id;

  return v_new_id;
end;
$$;

comment on function public.replay_webhook_delivery(uuid) is
  'Queues a fresh attempt for a delivery that ended in the dead letter queue.';

-- Rotates the signing secret with a grace window, so a receiver can accept
-- both the old and the new signature while it deploys.
create or replace function public.rotate_webhook_secret(
  p_endpoint_id uuid,
  p_new_secret_encrypted text,
  p_new_fingerprint text default null,
  p_grace_minutes integer default 5
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_endpoint public.webhook_endpoints%rowtype;
begin
  select * into v_endpoint
    from public.webhook_endpoints
   where id = p_endpoint_id and deleted_at is null for update;

  if not found then
    raise exception 'Endpoint % was not found', p_endpoint_id using errcode = 'P0002';
  end if;

  if not (public.is_service_role()
          or public.is_super_admin()
          or public.is_company_owner(v_endpoint.company_id)) then
    raise exception 'Only the account owner can rotate a signing secret'
      using errcode = '42501';
  end if;

  update public.webhook_endpoints
     set previous_secret_encrypted = signing_secret_encrypted,
         previous_secret_valid_until = now()
                                       + make_interval(mins => greatest(coalesce(p_grace_minutes, 5), 1)),
         signing_secret_encrypted = p_new_secret_encrypted,
         signing_secret_fingerprint = p_new_fingerprint,
         secret_key_version = secret_key_version + 1,
         updated_at = now()
   where id = p_endpoint_id;

  return true;
end;
$$;

comment on function public.rotate_webhook_secret(uuid, text, text, integer) is
  'Replaces the signing secret of an endpoint and keeps the old one briefly.';

-- The dead letter queue as a tenant sees it.
create or replace function public.webhook_dead_letters(
  p_company_id uuid,
  p_limit integer default 100
)
returns table (
  delivery_id uuid,
  endpoint_name text,
  event_type text,
  attempt_count smallint,
  last_status_code smallint,
  last_error text,
  dead_lettered_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select d.id,
         e.name,
         v.event_type,
         d.attempt_count,
         d.last_status_code,
         d.last_error,
         d.dead_lettered_at
    from public.webhook_deliveries as d
    join public.webhook_endpoints as e on e.id = d.endpoint_id
    join public.outbound_events as v on v.id = d.event_id
   where d.company_id = p_company_id
     and d.status = 'exhausted'
   order by d.dead_lettered_at desc
   limit greatest(coalesce(p_limit, 100), 1);
$$;

comment on function public.webhook_dead_letters(uuid, integer) is
  'Lists the events that could not be delivered and are waiting for a person.';
