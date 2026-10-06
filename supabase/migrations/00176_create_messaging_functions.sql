-- supabase/migrations/00176_create_messaging_functions.sql
-- Sending on a channel, and walking down the chain when it does not land.

-- Is this address allowed to be messaged on this channel?
create or replace function public.may_message_on_channel(
  p_company_id uuid,
  p_channel public.message_channel,
  p_address text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_identity public.contact_channel_identities%rowtype;
begin
  if p_address is null or p_channel = 'email' then
    return false;
  end if;

  if exists (
    select 1
      from public.channel_suppressions as s
     where s.channel = p_channel
       and s.address = p_address
       and s.released_at is null
       and (s.company_id is null or s.company_id = p_company_id)
  ) then
    return false;
  end if;

  select * into v_identity
    from public.contact_channel_identities
   where company_id = p_company_id
     and channel = p_channel
     and address = p_address
     and deleted_at is null;

  if not found then
    return false;
  end if;

  return v_identity.consent_state = 'opted_in';
end;
$$;

comment on function public.may_message_on_channel(
  uuid, public.message_channel, text
) is 'Returns whether an address has agreed to be messaged on this channel.';

-- Records an address somebody gave, with the consent that came with it.
create or replace function public.register_contact_channel(
  p_company_id uuid,
  p_channel public.message_channel,
  p_address text,
  p_client_id uuid default null,
  p_user_id uuid default null,
  p_consent_source text default null,
  p_make_primary boolean default true
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_identity_id uuid;
begin
  if not coalesce(
    public.is_service_role() or public.can_write_company_data(p_company_id),
    false
  ) then
    raise exception 'That account is not yours to write to' using errcode = '42501';
  end if;

  insert into public.contact_channel_identities (
    company_id, client_id, user_id, channel, address, is_primary,
    consent_state, consent_source, consent_recorded_at
  )
  values (
    p_company_id, p_client_id, p_user_id, p_channel, p_address,
    coalesce(p_make_primary, true),
    case when p_consent_source is null then 'unknown' else 'opted_in' end,
    p_consent_source,
    case when p_consent_source is null then null else now() end
  )
  on conflict (company_id, channel, address) where deleted_at is null
  do update set
    client_id = coalesce(excluded.client_id, contact_channel_identities.client_id),
    user_id = coalesce(excluded.user_id, contact_channel_identities.user_id),
    consent_state = case
      when excluded.consent_state = 'opted_in' then 'opted_in'
      else contact_channel_identities.consent_state
    end,
    consent_source = coalesce(excluded.consent_source,
                              contact_channel_identities.consent_source),
    consent_recorded_at = coalesce(excluded.consent_recorded_at,
                                   contact_channel_identities.consent_recorded_at),
    updated_at = now()
  returning id into v_identity_id;

  return v_identity_id;
end;
$$;

comment on function public.register_contact_channel(
  uuid, public.message_channel, text, uuid, uuid, text, boolean
) is 'Stores a messaging address and the consent that was given with it.';

-- Honours a STOP. One call stops every route that would have used it.
create or replace function public.opt_out_of_channel(
  p_company_id uuid,
  p_channel public.message_channel,
  p_address text,
  p_reason text default 'opted_out',
  p_source text default 'recipient_reply'
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.channel_suppressions (
    company_id, channel, address, reason, source
  )
  values (p_company_id, p_channel, p_address, p_reason, p_source)
  on conflict (
    coalesce(company_id, '00000000-0000-0000-0000-000000000000'::uuid),
    channel,
    address
  ) where released_at is null
  do nothing;

  update public.contact_channel_identities
     set consent_state = 'opted_out',
         opted_out_at = now(),
         opt_out_reason = p_reason,
         is_primary = false,
         updated_at = now()
   where company_id = p_company_id
     and channel = p_channel
     and address = p_address
     and deleted_at is null;

  return true;
end;
$$;

comment on function public.opt_out_of_channel(
  uuid, public.message_channel, text, text, text
) is 'Stops all further messages to an address on one channel.';

-- Picks the configured sender for a channel, preferring the tenant's own.
create or replace function public.resolve_messaging_channel(
  p_company_id uuid,
  p_channel public.message_channel
)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.id
    from public.messaging_channels as c
   where c.channel = p_channel
     and c.is_active
     and c.is_verified
     and c.deleted_at is null
     and (c.company_id = p_company_id or c.company_id is null)
   order by (c.company_id is not null) desc, c.routing_priority
   limit 1;
$$;

comment on function public.resolve_messaging_channel(
  uuid, public.message_channel
) is 'Returns the sender a tenant should use on a channel, tenant first.';

-- Queues one message on a channel that is not email.
create or replace function public.queue_channel_message(
  p_company_id uuid,
  p_channel public.message_channel,
  p_address text,
  p_body_text text,
  p_template_key text default null,
  p_client_id uuid default null,
  p_related_entity_type text default null,
  p_related_entity_id uuid default null,
  p_idempotency_key text default null,
  p_route_run_id uuid default null,
  p_step_order smallint default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_channel public.messaging_channels%rowtype;
  v_message_id uuid;
  v_key text;
  v_now timestamptz := now();
  v_scheduled timestamptz;
begin
  if not coalesce(
    public.is_service_role() or public.can_write_company_data(p_company_id),
    false
  ) then
    raise exception 'That account is not yours to send from' using errcode = '42501';
  end if;

  if not public.may_message_on_channel(p_company_id, p_channel, p_address) then
    raise exception 'This address has not agreed to messages on that channel'
      using errcode = '42501';
  end if;

  select * into v_channel
    from public.messaging_channels
   where id = public.resolve_messaging_channel(p_company_id, p_channel)
     for update;

  if not found then
    raise exception 'No verified sender is configured for that channel'
      using errcode = 'P0002';
  end if;

  if v_channel.send_window_resets_on < current_date then
    update public.messaging_channels
       set sent_today = 0,
           send_window_resets_on = current_date,
           updated_at = now()
     where id = v_channel.id;

    v_channel.sent_today := 0;
  end if;

  if v_channel.daily_send_limit is not null
     and v_channel.sent_today >= v_channel.daily_send_limit then
    raise exception 'That channel has reached what it may send today'
      using errcode = '22023';
  end if;

  -- Quiet hours push the message to the start of the next allowed window
  -- rather than dropping it.
  v_scheduled := null;

  if v_channel.quiet_hours_start is not null then
    if v_channel.quiet_hours_start < v_channel.quiet_hours_end then
      if v_now::time >= v_channel.quiet_hours_start
         and v_now::time < v_channel.quiet_hours_end then
        v_scheduled := date_trunc('day', v_now) + v_channel.quiet_hours_end;
      end if;
    else
      if v_now::time >= v_channel.quiet_hours_start then
        v_scheduled := date_trunc('day', v_now) + interval '1 day'
                       + v_channel.quiet_hours_end;
      elsif v_now::time < v_channel.quiet_hours_end then
        v_scheduled := date_trunc('day', v_now) + v_channel.quiet_hours_end;
      end if;
    end if;
  end if;

  v_key := coalesce(
    p_idempotency_key,
    coalesce(p_template_key, 'channel') || ':' || p_channel::text || ':'
      || p_address || ':' || to_char(v_now, 'YYYYMMDDHH24MISSMS')
  );

  select id into v_message_id
    from public.messages
   where idempotency_key = v_key;

  if v_message_id is not null then
    return v_message_id;
  end if;

  insert into public.messages (
    company_id, channel, status, template_key, to_phone, body_text,
    related_entity_type, related_entity_id, client_id, idempotency_key,
    scheduled_for, provider, requested_by, route_run_id, route_step_order,
    channel_cost
  )
  values (
    p_company_id,
    p_channel,
    case when v_scheduled is null then 'queued'::public.message_status
         else 'scheduled'::public.message_status
    end,
    p_template_key,
    p_address,
    p_body_text,
    p_related_entity_type,
    p_related_entity_id,
    p_client_id,
    v_key,
    v_scheduled,
    v_channel.provider,
    public.current_user_id(),
    p_route_run_id,
    p_step_order,
    v_channel.cost_per_message
  )
  returning id into v_message_id;

  update public.messaging_channels
     set sent_today = sent_today + 1,
         last_used_at = now(),
         updated_at = now()
   where id = v_channel.id;

  return v_message_id;
end;
$$;

comment on function public.queue_channel_message(
  uuid, public.message_channel, text, text, text, uuid, text, uuid, text, uuid,
  smallint
) is 'Queues one message on a channel other than email, with consent and caps applied.';

-- -----------------------------------------------------------------------------
-- Walking a chain
-- -----------------------------------------------------------------------------

-- Sends one step of a run, or reports that the step had nowhere to go.
create or replace function public.send_route_step(
  p_run_id uuid,
  p_step_order smallint
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_run public.message_route_runs%rowtype;
  v_route public.message_routes%rowtype;
  v_step public.message_route_steps%rowtype;
  v_address text;
  v_email text;
  v_sent boolean := false;
begin
  select * into v_run from public.message_route_runs where id = p_run_id for update;

  if not found or v_run.status <> 'running' then
    return false;
  end if;

  if not coalesce(
    public.is_service_role()
    or public.is_super_admin()
    or public.is_company_owner(v_run.company_id),
    false
  ) then
    raise exception 'That conversation is not yours to continue'
      using errcode = '42501';
  end if;

  select * into v_route from public.message_routes where id = v_run.route_id;

  select * into v_step
    from public.message_route_steps
   where route_id = v_run.route_id and step_order = p_step_order;

  if not found then
    update public.message_route_runs
       set status = 'exhausted',
           completed_at = now(),
           next_action_at = null,
           updated_at = now()
     where id = p_run_id;

    return false;
  end if;

  if v_step.channel = 'email' then
    select c.email::text into v_email
      from public.clients as c
     where c.id = v_run.client_id and c.deleted_at is null;

    if v_email is not null and v_step.template_key is not null then
      perform public.queue_message(
        v_run.company_id, v_step.template_key, v_email, v_run.variables, null,
        null, v_run.related_entity_type, v_run.related_entity_id, v_run.client_id,
        null, 'email'::public.message_channel
      );
      v_sent := true;
    end if;
  else
    select i.address into v_address
      from public.contact_channel_identities as i
     where i.company_id = v_run.company_id
       and i.channel = v_step.channel
       and i.deleted_at is null
       and (
         (v_run.client_id is not null and i.client_id = v_run.client_id)
         or (v_run.user_id is not null and i.user_id = v_run.user_id)
       )
       and (not v_route.requires_consent or i.consent_state = 'opted_in')
     order by i.is_primary desc, i.created_at
     limit 1;

    -- A channel with no configured sender is skipped rather than failed.
    if v_address is not null
       and public.resolve_messaging_channel(v_run.company_id, v_step.channel) is not null
       and public.may_message_on_channel(v_run.company_id, v_step.channel, v_address) then
      perform public.queue_channel_message(
        v_run.company_id, v_step.channel, v_address,
        public.render_template_text(
          coalesce(v_run.variables ->> 'body_text', ''), v_run.variables
        ),
        v_step.template_key, v_run.client_id, v_run.related_entity_type,
        v_run.related_entity_id, null, p_run_id, p_step_order
      );
      v_sent := true;
    end if;
  end if;

  update public.message_route_runs
     set current_step_order = p_step_order,
         attempted_channels = case
           when v_sent then array_append(attempted_channels, v_step.channel::text)
           else attempted_channels
         end,
         next_action_at = now() + make_interval(mins => v_step.wait_minutes),
         updated_at = now()
   where id = p_run_id;

  return v_sent;
end;
$$;

comment on function public.send_route_step(uuid, smallint) is
  'Sends one step of a routed conversation, skipping a channel with no address.';

-- Opens a routed conversation and sends its first step at once.
create or replace function public.start_message_route(
  p_company_id uuid,
  p_route_key text,
  p_client_id uuid default null,
  p_user_id uuid default null,
  p_related_entity_type text default null,
  p_related_entity_id uuid default null,
  p_variables jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_route public.message_routes%rowtype;
  v_run_id uuid;
  v_first smallint;
begin
  if not coalesce(
    public.is_service_role() or public.can_write_company_data(p_company_id),
    false
  ) then
    raise exception 'That account is not yours to send from' using errcode = '42501';
  end if;

  select * into v_route
    from public.message_routes
   where route_key = p_route_key
     and is_active
     and deleted_at is null
     and (company_id = p_company_id or company_id is null)
   order by (company_id is not null) desc
   limit 1;

  if not found then
    raise exception 'There is no route called %', p_route_key using errcode = 'P0002';
  end if;

  select min(step_order) into v_first
    from public.message_route_steps
   where route_id = v_route.id;

  if v_first is null then
    raise exception 'That route has no channels in it' using errcode = '22023';
  end if;

  insert into public.message_route_runs (
    company_id, route_id, client_id, user_id, related_entity_type,
    related_entity_id, variables, created_by
  )
  values (
    p_company_id, v_route.id, p_client_id, p_user_id, p_related_entity_type,
    p_related_entity_id, coalesce(p_variables, '{}'::jsonb),
    public.current_user_id()
  )
  returning id into v_run_id;

  perform public.send_route_step(v_run_id, v_first);

  return v_run_id;
end;
$$;

comment on function public.start_message_route(
  uuid, text, uuid, uuid, text, uuid, jsonb
) is 'Begins a fallback chain and sends its first step immediately.';

-- Stops a run as soon as the message actually arrived.
create or replace function public.record_route_delivery(
  p_message_id uuid,
  p_engaged boolean default false
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_message public.messages%rowtype;
  v_route public.message_routes%rowtype;
begin
  if not coalesce(public.is_service_role() or public.is_super_admin(), false) then
    raise exception 'Delivery is reported by the platform' using errcode = '42501';
  end if;

  select * into v_message from public.messages where id = p_message_id;

  if not found or v_message.route_run_id is null then
    return false;
  end if;

  select r.* into v_route
    from public.message_routes as r
    join public.message_route_runs as run on run.route_id = r.id
   where run.id = v_message.route_run_id;

  if not coalesce(p_engaged, false) and not v_route.stop_on_delivery then
    return false;
  end if;

  update public.message_route_runs
     set status = case when coalesce(p_engaged, false) then 'engaged' else 'delivered' end,
         delivered_channel = coalesce(delivered_channel, v_message.channel),
         delivered_at = coalesce(delivered_at, now()),
         engaged_at = case when coalesce(p_engaged, false) then now() else engaged_at end,
         completed_at = now(),
         next_action_at = null,
         updated_at = now()
   where id = v_message.route_run_id
     and status = 'running';

  return found;
end;
$$;

comment on function public.record_route_delivery(uuid, boolean) is
  'Closes a routed conversation once one channel has actually landed.';

-- Moves every run whose step has run out of time on to the next channel.
create or replace function public.advance_message_routes(
  p_limit integer default 100
)
returns integer
language plpgsql
volatile
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_run record;
  v_next smallint;
  v_count integer := 0;
begin
  if not coalesce(public.is_service_role() or public.is_super_admin(), false) then
    raise exception 'Routes are advanced by the platform' using errcode = '42501';
  end if;

  for v_run in
    select id, route_id, current_step_order
      from public.message_route_runs
     where status = 'running'
       and next_action_at is not null
       and next_action_at <= now()
     order by next_action_at
     limit greatest(coalesce(p_limit, 100), 1)
     for update skip locked
  loop
    select min(step_order) into v_next
      from public.message_route_steps
     where route_id = v_run.route_id
       and step_order > coalesce(v_run.current_step_order, 0);

    if v_next is null then
      update public.message_route_runs
         set status = 'exhausted',
             completed_at = now(),
             next_action_at = null,
             updated_at = now()
       where id = v_run.id;
    else
      perform public.send_route_step(v_run.id, v_next);
    end if;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

comment on function public.advance_message_routes(integer) is
  'Tries the next channel for every routed conversation that has waited long enough.';

-- Takes in a reply, and treats a STOP as a STOP.
create or replace function public.record_inbound_message(
  p_company_id uuid,
  p_channel public.message_channel,
  p_from_address text,
  p_body_text text,
  p_provider text default null,
  p_provider_message_id text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_inbound_id uuid;
  v_is_opt_out boolean;
  v_client_id uuid;
begin
  if not coalesce(public.is_service_role() or public.is_super_admin(), false) then
    raise exception 'Replies are recorded by the platform' using errcode = '42501';
  end if;

  v_is_opt_out := upper(btrim(coalesce(p_body_text, ''))) in
    ('STOP', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT', 'STOP ALL');

  select client_id into v_client_id
    from public.contact_channel_identities
   where company_id = p_company_id
     and channel = p_channel
     and address = p_from_address
     and deleted_at is null;

  insert into public.inbound_messages (
    company_id, channel, from_address, body_text, provider, provider_message_id,
    client_id, is_opt_out, is_handled, handled_at
  )
  values (
    p_company_id, p_channel, p_from_address, p_body_text, p_provider,
    p_provider_message_id, v_client_id, v_is_opt_out, v_is_opt_out,
    case when v_is_opt_out then now() else null end
  )
  returning id into v_inbound_id;

  if v_is_opt_out then
    perform public.opt_out_of_channel(
      p_company_id, p_channel, p_from_address, 'opted_out', 'recipient_reply'
    );
  end if;

  return v_inbound_id;
end;
$$;

comment on function public.record_inbound_message(
  uuid, public.message_channel, text, text, text, text
) is 'Stores a reply and acts on it when the reply is a request to stop.';

-- What each channel cost and how well it worked.
create or replace function public.channel_usage_summary(
  p_company_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  channel public.message_channel,
  sent_count integer,
  delivered_count integer,
  failed_count integer,
  total_cost numeric
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not coalesce(
    public.is_service_role() or public.has_company_access(p_company_id),
    false
  ) then
    raise exception 'That account is not yours to read' using errcode = '42501';
  end if;

  return query
  select m.channel,
         count(*)::integer,
         (count(*) filter (where m.delivered_at is not null))::integer,
         (count(*) filter (where m.status = 'failed'))::integer,
         coalesce(sum(m.channel_cost), 0)
    from public.messages as m
   where m.company_id = p_company_id
     and m.created_at >= p_from
     and m.created_at < p_to
   group by m.channel
   order by m.channel;
end;
$$;

comment on function public.channel_usage_summary(uuid, timestamptz, timestamptz) is
  'Reports volume, delivery and spend per messaging channel.';
