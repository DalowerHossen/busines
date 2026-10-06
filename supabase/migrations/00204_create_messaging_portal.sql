-- supabase/migrations/00204_create_messaging_portal.sql
-- Giving a business control of the channels it reaches people on.
--
-- The plumbing for text messages, chat apps and fallback chains was already
-- in place, but it could only be driven from the inside. This file adds the
-- routines the interface needs: reading the channels a business has set up,
-- editing them, laying out a fallback chain in one go, watching the chains
-- that are running, and stopping one that should not continue. Every routine
-- asks the same tenancy question as the tables underneath it, and the ones
-- that change a channel ask for the owner rather than any member of staff,
-- because a channel spends money every time it is used.

-- -----------------------------------------------------------------------------
-- Room for a supplier nobody has written code for
-- -----------------------------------------------------------------------------

-- Endpoints and field names, so a new supplier is a form rather than a
-- release. Secrets never live here; they stay in the encrypted vault.
alter table public.messaging_channels
  add column adapter_settings jsonb not null default '{}'::jsonb;

alter table public.messaging_channels
  add constraint messaging_channels_adapter_settings_check
    check (jsonb_typeof(adapter_settings) = 'object');

comment on column public.messaging_channels.adapter_settings is
  'Addresses and field names a configurable supplier is reached with.';

-- -----------------------------------------------------------------------------
-- Reading what is configured
-- -----------------------------------------------------------------------------

create or replace function public.company_messaging_channels(
  p_company_id uuid
)
returns table (
  channel_id uuid,
  channel public.message_channel,
  provider text,
  display_name text,
  sender_number text,
  sender_handle text,
  is_platform_channel boolean,
  is_active boolean,
  is_verified boolean,
  routing_priority smallint,
  cost_per_message numeric,
  cost_currency char(3),
  daily_send_limit integer,
  sent_today integer,
  quiet_hours_start time,
  quiet_hours_end time,
  adapter_settings jsonb,
  last_used_at timestamptz,
  last_error text,
  last_error_at timestamptz
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
    raise exception 'Those channels belong to another business' using errcode = '42501';
  end if;

  return query
  select c.id,
         c.channel,
         c.provider,
         c.display_name,
         c.sender_number,
         c.sender_handle,
         c.company_id is null,
         c.is_active,
         c.is_verified,
         c.routing_priority,
         c.cost_per_message,
         c.cost_currency,
         c.daily_send_limit,
         c.sent_today,
         c.quiet_hours_start,
         c.quiet_hours_end,
         c.adapter_settings,
         c.last_used_at,
         c.last_error,
         c.last_error_at
    from public.messaging_channels as c
   where c.deleted_at is null
     and (c.company_id = p_company_id or c.company_id is null)
   order by (c.company_id is null), c.routing_priority, c.channel;
end;
$$;

comment on function public.company_messaging_channels(uuid) is
  'Lists the channels a business can send on, its own first.';

-- -----------------------------------------------------------------------------
-- Editing a channel
-- -----------------------------------------------------------------------------

-- One routine covers both the first save and every later edit, because the
-- pair of a channel and a provider is what makes a sender unique.
create or replace function public.save_messaging_channel(
  p_company_id uuid,
  p_channel public.message_channel,
  p_provider text,
  p_display_name text,
  p_sender_number text default null,
  p_sender_handle text default null,
  p_sender_display_name text default null,
  p_credential_id uuid default null,
  p_cost_per_message numeric default 0,
  p_cost_currency char(3) default 'USD',
  p_daily_send_limit integer default null,
  p_routing_priority smallint default 100,
  p_quiet_hours_start time default null,
  p_quiet_hours_end time default null,
  p_adapter_settings jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_channel_id uuid;
begin
  if not coalesce(
    public.is_service_role() or public.is_company_owner(p_company_id),
    false
  ) then
    raise exception 'Only the owner of a business can change how it sends'
      using errcode = '42501';
  end if;

  if p_channel = 'email' then
    raise exception 'Email is configured with its own sender identities'
      using errcode = '22023';
  end if;

  insert into public.messaging_channels (
    company_id, channel, provider, display_name, sender_number, sender_handle,
    sender_display_name, credential_id, cost_per_message, cost_currency,
    daily_send_limit, routing_priority, quiet_hours_start, quiet_hours_end,
    adapter_settings, created_by, updated_by
  )
  values (
    p_company_id, p_channel, p_provider, btrim(p_display_name), p_sender_number,
    p_sender_handle, p_sender_display_name, p_credential_id,
    coalesce(p_cost_per_message, 0), coalesce(p_cost_currency, 'USD'),
    p_daily_send_limit, coalesce(p_routing_priority, 100::smallint),
    p_quiet_hours_start, p_quiet_hours_end,
    case when jsonb_typeof(coalesce(p_adapter_settings, '{}'::jsonb)) = 'object'
         then coalesce(p_adapter_settings, '{}'::jsonb)
         else '{}'::jsonb
    end,
    public.current_user_id(), public.current_user_id()
  )
  on conflict (coalesce(company_id, '00000000-0000-0000-0000-000000000000'::uuid), channel, provider)
    where deleted_at is null
  do update set
    display_name = excluded.display_name,
    sender_number = excluded.sender_number,
    sender_handle = excluded.sender_handle,
    sender_display_name = excluded.sender_display_name,
    credential_id = excluded.credential_id,
    cost_per_message = excluded.cost_per_message,
    cost_currency = excluded.cost_currency,
    daily_send_limit = excluded.daily_send_limit,
    routing_priority = excluded.routing_priority,
    quiet_hours_start = excluded.quiet_hours_start,
    quiet_hours_end = excluded.quiet_hours_end,
    adapter_settings = excluded.adapter_settings,
    updated_by = public.current_user_id(),
    updated_at = now()
  returning id into v_channel_id;

  return v_channel_id;
end;
$$;

comment on function public.save_messaging_channel(
  uuid, public.message_channel, text, text, text, text, text, uuid, numeric,
  char, integer, smallint, time, time, jsonb
) is 'Creates or edits one sending channel for a business.';

-- Switching a channel off is how a business stops spending on it without
-- losing what it was configured with.
create or replace function public.set_messaging_channel_active(
  p_channel_id uuid,
  p_is_active boolean
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
begin
  select company_id into v_company_id
    from public.messaging_channels
   where id = p_channel_id and deleted_at is null;

  if not found then
    raise exception 'There is no such channel' using errcode = 'P0002';
  end if;

  if v_company_id is null then
    if not coalesce(public.is_service_role() or public.is_super_admin(), false) then
      raise exception 'That channel belongs to the platform' using errcode = '42501';
    end if;
  elsif not coalesce(
    public.is_service_role() or public.is_company_owner(v_company_id),
    false
  ) then
    raise exception 'That channel is not yours to change' using errcode = '42501';
  end if;

  update public.messaging_channels
     set is_active = coalesce(p_is_active, false),
         updated_by = public.current_user_id(),
         updated_at = now()
   where id = p_channel_id;

  return coalesce(p_is_active, false);
end;
$$;

comment on function public.set_messaging_channel_active(uuid, boolean) is
  'Turns one sending channel on or off without losing its configuration.';

-- The result of a connection test, written by the platform after it has
-- actually spoken to the provider.
create or replace function public.record_channel_test(
  p_channel_id uuid,
  p_is_healthy boolean,
  p_message text default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  if not coalesce(public.is_service_role() or public.is_super_admin(), false) then
    raise exception 'A channel is tested by the platform' using errcode = '42501';
  end if;

  update public.messaging_channels
     set is_verified = coalesce(p_is_healthy, false),
         verified_at = case when coalesce(p_is_healthy, false) then now() else verified_at end,
         last_error = case when coalesce(p_is_healthy, false) then null else p_message end,
         last_error_at = case when coalesce(p_is_healthy, false) then null else now() end,
         updated_at = now()
   where id = p_channel_id
     and deleted_at is null;

  return found;
end;
$$;

comment on function public.record_channel_test(uuid, boolean, text) is
  'Records whether a channel could actually reach its provider.';

-- -----------------------------------------------------------------------------
-- Fallback chains
-- -----------------------------------------------------------------------------

create or replace function public.company_message_routes(
  p_company_id uuid
)
returns table (
  route_id uuid,
  route_key text,
  name text,
  description text,
  notification_kind public.notification_type,
  is_platform_route boolean,
  is_active boolean,
  stop_on_delivery boolean,
  stop_on_engagement boolean,
  respect_quiet_hours boolean,
  requires_consent boolean,
  max_total_cost numeric,
  cost_currency char(3),
  steps jsonb,
  running_count integer
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
    raise exception 'Those routes belong to another business' using errcode = '42501';
  end if;

  return query
  select r.id,
         r.route_key,
         r.name,
         r.description,
         r.notification_kind,
         r.company_id is null,
         r.is_active,
         r.stop_on_delivery,
         r.stop_on_engagement,
         r.respect_quiet_hours,
         r.requires_consent,
         r.max_total_cost,
         r.cost_currency,
         coalesce(
           (
             select jsonb_agg(
                      jsonb_build_object(
                        'step_order', s.step_order,
                        'channel', s.channel,
                        'template_key', s.template_key,
                        'wait_minutes', s.wait_minutes,
                        'is_required', s.is_required,
                        'max_attempts', s.max_attempts
                      )
                      order by s.step_order
                    )
               from public.message_route_steps as s
              where s.route_id = r.id
           ),
           '[]'::jsonb
         ),
         (
           select count(*)::int
             from public.message_route_runs as run
            where run.route_id = r.id
              and run.company_id = p_company_id
              and run.status = 'running'
         )
    from public.message_routes as r
   where r.deleted_at is null
     and (r.company_id = p_company_id or r.company_id is null)
   order by (r.company_id is null), r.name;
end;
$$;

comment on function public.company_message_routes(uuid) is
  'Lists the fallback chains a business can use, with their steps.';

create or replace function public.save_message_route(
  p_company_id uuid,
  p_route_key text,
  p_name text,
  p_description text default null,
  p_notification_kind public.notification_type default null,
  p_is_active boolean default true,
  p_stop_on_delivery boolean default true,
  p_stop_on_engagement boolean default true,
  p_respect_quiet_hours boolean default true,
  p_requires_consent boolean default true,
  p_max_total_cost numeric default null,
  p_cost_currency char(3) default 'USD'
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_route_id uuid;
begin
  if not coalesce(
    public.is_service_role() or public.is_company_owner(p_company_id),
    false
  ) then
    raise exception 'Only the owner of a business can change how it reaches people'
      using errcode = '42501';
  end if;

  insert into public.message_routes (
    company_id, route_key, name, description, notification_kind, is_active,
    stop_on_delivery, stop_on_engagement, respect_quiet_hours, requires_consent,
    max_total_cost, cost_currency, created_by, updated_by
  )
  values (
    p_company_id, p_route_key, btrim(p_name), p_description, p_notification_kind,
    coalesce(p_is_active, true), coalesce(p_stop_on_delivery, true),
    coalesce(p_stop_on_engagement, true), coalesce(p_respect_quiet_hours, true),
    coalesce(p_requires_consent, true), p_max_total_cost,
    coalesce(p_cost_currency, 'USD'),
    public.current_user_id(), public.current_user_id()
  )
  on conflict (coalesce(company_id, '00000000-0000-0000-0000-000000000000'::uuid), route_key)
    where deleted_at is null
  do update set
    name = excluded.name,
    description = excluded.description,
    notification_kind = excluded.notification_kind,
    is_active = excluded.is_active,
    stop_on_delivery = excluded.stop_on_delivery,
    stop_on_engagement = excluded.stop_on_engagement,
    respect_quiet_hours = excluded.respect_quiet_hours,
    requires_consent = excluded.requires_consent,
    max_total_cost = excluded.max_total_cost,
    cost_currency = excluded.cost_currency,
    updated_by = public.current_user_id(),
    updated_at = now()
  returning id into v_route_id;

  return v_route_id;
end;
$$;

comment on function public.save_message_route(
  uuid, text, text, text, public.notification_type, boolean, boolean, boolean,
  boolean, boolean, numeric, char
) is 'Creates or edits one fallback chain belonging to a business.';

-- The chain is replaced in one go, because an order with a gap in it is not
-- a chain anybody can reason about.
create or replace function public.set_message_route_steps(
  p_route_id uuid,
  p_steps jsonb
)
returns integer
language plpgsql
volatile
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_company_id uuid;
  v_step jsonb;
  v_order smallint := 0;
  v_seen text[] := array[]::text[];
  v_channel public.message_channel;
begin
  select company_id into v_company_id
    from public.message_routes
   where id = p_route_id and deleted_at is null;

  if not found then
    raise exception 'There is no such route' using errcode = 'P0002';
  end if;

  if v_company_id is null then
    if not coalesce(public.is_service_role() or public.is_super_admin(), false) then
      raise exception 'That route belongs to the platform' using errcode = '42501';
    end if;
  elsif not coalesce(
    public.is_service_role() or public.is_company_owner(v_company_id),
    false
  ) then
    raise exception 'That route is not yours to change' using errcode = '42501';
  end if;

  if jsonb_typeof(coalesce(p_steps, 'null'::jsonb)) <> 'array' then
    raise exception 'The chain has to be a list of steps' using errcode = '22023';
  end if;

  if jsonb_array_length(p_steps) = 0 then
    raise exception 'A chain with no channels in it would never reach anybody'
      using errcode = '22023';
  end if;

  if jsonb_array_length(p_steps) > 10 then
    raise exception 'A chain cannot have more than ten channels in it'
      using errcode = '22023';
  end if;

  delete from public.message_route_steps where route_id = p_route_id;

  for v_step in select * from jsonb_array_elements(p_steps)
  loop
    v_order := v_order + 1;
    v_channel := (v_step ->> 'channel')::public.message_channel;

    if v_channel::text = any (v_seen) then
      raise exception 'A chain cannot try the same channel twice'
        using errcode = '23505';
    end if;

    v_seen := array_append(v_seen, v_channel::text);

    insert into public.message_route_steps (
      route_id, step_order, channel, template_key, wait_minutes, is_required,
      max_attempts
    )
    values (
      p_route_id,
      v_order,
      v_channel,
      nullif(btrim(coalesce(v_step ->> 'template_key', '')), ''),
      coalesce((v_step ->> 'wait_minutes')::integer, 60),
      coalesce((v_step ->> 'is_required')::boolean, false),
      coalesce((v_step ->> 'max_attempts')::smallint, 1::smallint)
    );
  end loop;

  update public.message_routes
     set updated_by = public.current_user_id(),
         updated_at = now()
   where id = p_route_id;

  return v_order;
end;
$$;

comment on function public.set_message_route_steps(uuid, jsonb) is
  'Replaces the ordered channels of one fallback chain.';

-- -----------------------------------------------------------------------------
-- Watching the chains that are running
-- -----------------------------------------------------------------------------

create or replace function public.message_route_activity(
  p_company_id uuid,
  p_limit integer default 50
)
returns table (
  run_id uuid,
  route_name text,
  client_name text,
  related_entity_type text,
  related_entity_id uuid,
  status text,
  current_step_order smallint,
  attempted_channels text[],
  delivered_channel public.message_channel,
  next_action_at timestamptz,
  total_cost numeric,
  started_at timestamptz,
  completed_at timestamptz
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
    raise exception 'That activity belongs to another business' using errcode = '42501';
  end if;

  return query
  select run.id,
         r.name,
         c.display_name,
         run.related_entity_type,
         run.related_entity_id,
         run.status,
         run.current_step_order,
         run.attempted_channels,
         run.delivered_channel,
         run.next_action_at,
         run.total_cost,
         run.created_at,
         run.completed_at
    from public.message_route_runs as run
    join public.message_routes as r on r.id = run.route_id
    left join public.clients as c on c.id = run.client_id
   where run.company_id = p_company_id
   order by run.created_at desc
   limit greatest(coalesce(p_limit, 50), 1);
end;
$$;

comment on function public.message_route_activity(uuid, integer) is
  'Lists recent fallback chains with how far each one got.';

create or replace function public.stop_message_route_run(
  p_run_id uuid,
  p_reason text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
begin
  select company_id into v_company_id
    from public.message_route_runs
   where id = p_run_id;

  if not found then
    raise exception 'There is no such conversation' using errcode = 'P0002';
  end if;

  if not coalesce(
    public.is_service_role() or public.is_company_owner(v_company_id),
    false
  ) then
    raise exception 'That conversation is not yours to stop' using errcode = '42501';
  end if;

  if length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Say why the conversation is being stopped' using errcode = '22023';
  end if;

  update public.message_route_runs
     set status = 'stopped',
         stop_reason = btrim(p_reason),
         completed_at = now(),
         next_action_at = null,
         updated_at = now()
   where id = p_run_id
     and status = 'running';

  return found;
end;
$$;

comment on function public.stop_message_route_run(uuid, text) is
  'Stops a fallback chain before it tries another channel.';

-- -----------------------------------------------------------------------------
-- One picture of reach
-- -----------------------------------------------------------------------------

create or replace function public.messaging_overview(
  p_company_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if not coalesce(
    public.is_service_role() or public.has_company_access(p_company_id),
    false
  ) then
    raise exception 'That account is not yours to read' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'active_channels', (
      select count(*)::int
        from public.messaging_channels
       where deleted_at is null
         and is_active
         and (company_id = p_company_id or company_id is null)
    ),
    'verified_channels', (
      select count(*)::int
        from public.messaging_channels
       where deleted_at is null
         and is_active
         and is_verified
         and (company_id = p_company_id or company_id is null)
    ),
    'reachable_people', (
      select count(distinct coalesce(client_id, user_id))::int
        from public.contact_channel_identities
       where company_id = p_company_id
         and deleted_at is null
         and consent_state = 'opted_in'
    ),
    'opted_out_people', (
      select count(distinct coalesce(client_id, user_id))::int
        from public.contact_channel_identities
       where company_id = p_company_id
         and deleted_at is null
         and consent_state = 'opted_out'
    ),
    'running_routes', (
      select count(*)::int
        from public.message_route_runs
       where company_id = p_company_id
         and status = 'running'
    ),
    'delivered_routes', (
      select count(*)::int
        from public.message_route_runs
       where company_id = p_company_id
         and status in ('delivered', 'engaged')
    ),
    'exhausted_routes', (
      select count(*)::int
        from public.message_route_runs
       where company_id = p_company_id
         and status = 'exhausted'
    ),
    'unhandled_replies', (
      select count(*)::int
        from public.inbound_messages
       where company_id = p_company_id
         and not is_handled
    ),
    'spend_last_30_days', (
      select coalesce(round(sum(channel_cost), 4), 0)
        from public.messages
       where company_id = p_company_id
         and channel <> 'email'
         and created_at >= now() - interval '30 days'
    )
  ) into v_result;

  return v_result;
end;
$$;

comment on function public.messaging_overview(uuid) is
  'One figure each for reach, consent, chains in flight and spend.';

-- -----------------------------------------------------------------------------
-- Replies waiting for somebody
-- -----------------------------------------------------------------------------

create or replace function public.pending_inbound_messages(
  p_company_id uuid,
  p_limit integer default 50
)
returns table (
  inbound_id uuid,
  channel public.message_channel,
  from_address text,
  body_text text,
  client_name text,
  is_opt_out boolean,
  received_at timestamptz
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
    raise exception 'Those replies belong to another business' using errcode = '42501';
  end if;

  return query
  select m.id,
         m.channel,
         m.from_address,
         m.body_text,
         c.display_name,
         m.is_opt_out,
         m.received_at
    from public.inbound_messages as m
    left join public.clients as c on c.id = m.client_id
   where m.company_id = p_company_id
     and not m.is_handled
   order by m.received_at desc
   limit greatest(coalesce(p_limit, 50), 1);
end;
$$;

comment on function public.pending_inbound_messages(uuid, integer) is
  'Lists replies nobody has dealt with yet, newest first.';

create or replace function public.mark_inbound_handled(
  p_inbound_id uuid,
  p_note text default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
begin
  select company_id into v_company_id
    from public.inbound_messages
   where id = p_inbound_id;

  if not found then
    raise exception 'There is no such reply' using errcode = 'P0002';
  end if;

  if not coalesce(
    public.is_service_role() or public.can_write_company_data(v_company_id),
    false
  ) then
    raise exception 'That reply is not yours to deal with' using errcode = '42501';
  end if;

  update public.inbound_messages
     set is_handled = true,
         handled_at = now(),
         handled_by = public.current_user_id(),
         handling_note = nullif(btrim(coalesce(p_note, '')), ''),
         updated_at = now()
   where id = p_inbound_id
     and not is_handled;

  return found;
end;
$$;

comment on function public.mark_inbound_handled(uuid, text) is
  'Marks one reply as dealt with, with an optional note.';

-- -----------------------------------------------------------------------------
-- Who may call what
-- -----------------------------------------------------------------------------

revoke execute on function public.company_messaging_channels(uuid)
  from public, authenticated;
revoke execute on function public.save_messaging_channel(
  uuid, public.message_channel, text, text, text, text, text, uuid, numeric,
  char, integer, smallint, time, time, jsonb
) from public, authenticated;
revoke execute on function public.set_messaging_channel_active(uuid, boolean)
  from public, authenticated;
revoke execute on function public.record_channel_test(uuid, boolean, text)
  from public, authenticated;
revoke execute on function public.company_message_routes(uuid)
  from public, authenticated;
revoke execute on function public.save_message_route(
  uuid, text, text, text, public.notification_type, boolean, boolean, boolean,
  boolean, boolean, numeric, char
) from public, authenticated;
revoke execute on function public.set_message_route_steps(uuid, jsonb)
  from public, authenticated;
revoke execute on function public.message_route_activity(uuid, integer)
  from public, authenticated;
revoke execute on function public.stop_message_route_run(uuid, text)
  from public, authenticated;
revoke execute on function public.messaging_overview(uuid)
  from public, authenticated;
revoke execute on function public.pending_inbound_messages(uuid, integer)
  from public, authenticated;
revoke execute on function public.mark_inbound_handled(uuid, text)
  from public, authenticated;

grant execute on function public.company_messaging_channels(uuid)
  to authenticated, service_role;
grant execute on function public.save_messaging_channel(
  uuid, public.message_channel, text, text, text, text, text, uuid, numeric,
  char, integer, smallint, time, time, jsonb
) to authenticated, service_role;
grant execute on function public.set_messaging_channel_active(uuid, boolean)
  to authenticated, service_role;
grant execute on function public.record_channel_test(uuid, boolean, text)
  to service_role;
grant execute on function public.company_message_routes(uuid)
  to authenticated, service_role;
grant execute on function public.save_message_route(
  uuid, text, text, text, public.notification_type, boolean, boolean, boolean,
  boolean, boolean, numeric, char
) to authenticated, service_role;
grant execute on function public.set_message_route_steps(uuid, jsonb)
  to authenticated, service_role;
grant execute on function public.message_route_activity(uuid, integer)
  to authenticated, service_role;
grant execute on function public.stop_message_route_run(uuid, text)
  to authenticated, service_role;
grant execute on function public.messaging_overview(uuid)
  to authenticated, service_role;
grant execute on function public.pending_inbound_messages(uuid, integer)
  to authenticated, service_role;
grant execute on function public.mark_inbound_handled(uuid, text)
  to authenticated, service_role;
