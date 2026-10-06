-- supabase/migrations/00226_create_webhook_endpoint_admin.sql
-- Letting a business be told when something happens, by its own software.
--
-- The delivery machinery exists: events are queued, attempts are recorded,
-- failures back off and eventually land in a dead letter list. What was
-- missing is the part a business touches, and three rules that keep an
-- outbound webhook from becoming a way to attack somebody.
--
-- An endpoint must be a secure address, because the payload describes money
-- and clients. It cannot point at a private network address, because a
-- webhook that can be aimed inside our own infrastructure is a tool for
-- reading things it should not. And the signing secret is written once and
-- shown once: from then on only its fingerprint is readable, so that a
-- stolen database row cannot be used to forge an event.

create or replace function public.save_webhook_endpoint(
  p_company_id uuid,
  p_name text,
  p_target_url text,
  p_subscribed_events text[],
  p_signing_secret_encrypted text default null,
  p_signing_secret_fingerprint text default null,
  p_description text default null,
  p_endpoint_id uuid default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_endpoint_id uuid;
  v_host text;
begin
  if not (public.is_service_role() or public.is_company_owner(p_company_id)) then
    raise exception 'Only the account owner may send this account data elsewhere'
      using errcode = '42501';
  end if;

  if p_target_url !~ '^https://' then
    raise exception 'A webhook address has to be secure, starting with https'
      using errcode = '22023';
  end if;

  v_host := lower(split_part(split_part(regexp_replace(p_target_url, '^https://', ''), '/', 1), ':', 1));

  -- An address inside our own network is not an integration; it is a way to
  -- make this server fetch something it was never meant to reach.
  if v_host in ('localhost', '127.0.0.1', '0.0.0.0', '::1')
     or v_host like '10.%'
     or v_host like '192.168.%'
     or v_host like '169.254.%'
     or v_host ~ '^172\.(1[6-9]|2[0-9]|3[01])\.'
     or v_host like '%.internal'
     or v_host like '%.local' then
    raise exception 'That address is inside a private network and cannot receive events'
      using errcode = '22023';
  end if;

  if coalesce(array_length(p_subscribed_events, 1), 0) = 0 then
    raise exception 'Choose at least one event to be told about' using errcode = '22023';
  end if;

  if array_length(p_subscribed_events, 1) > 40 then
    raise exception 'That is more events than exist' using errcode = '22023';
  end if;

  if p_endpoint_id is null then
    if p_signing_secret_encrypted is null then
      raise exception 'A new endpoint needs a signing secret' using errcode = '22023';
    end if;

    insert into public.webhook_endpoints (
      company_id, name, target_url, description, signing_secret_encrypted,
      signing_secret_fingerprint, subscribed_events, created_by, updated_by
    )
    values (
      p_company_id, btrim(p_name), btrim(p_target_url),
      nullif(btrim(coalesce(p_description, '')), ''),
      p_signing_secret_encrypted, p_signing_secret_fingerprint,
      p_subscribed_events, public.current_user_id(), public.current_user_id()
    )
    returning id into v_endpoint_id;

    return v_endpoint_id;
  end if;

  update public.webhook_endpoints
     set name = btrim(p_name),
         target_url = btrim(p_target_url),
         description = case
                         when p_description is null then description
                         else nullif(btrim(p_description), '')
                       end,
         subscribed_events = p_subscribed_events,
         updated_at = now(),
         updated_by = public.current_user_id()
   where id = p_endpoint_id
     and company_id = p_company_id
     and deleted_at is null;

  if not found then
    raise exception 'That endpoint was not found' using errcode = 'P0002';
  end if;

  return p_endpoint_id;
end;
$$;

comment on function public.save_webhook_endpoint(
  uuid, text, text, text[], text, text, text, uuid
) is 'Points a business at its own software, refusing addresses inside a private network.';

create or replace function public.set_webhook_endpoint_state(
  p_endpoint_id uuid,
  p_is_active boolean,
  p_reason text default null
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
    from public.webhook_endpoints
   where id = p_endpoint_id
     and deleted_at is null;

  if v_company_id is null then
    return false;
  end if;

  if not (public.is_service_role() or public.is_company_owner(v_company_id)) then
    raise exception 'Only the account owner may change where this account sends data'
      using errcode = '42501';
  end if;

  update public.webhook_endpoints
     set is_active = p_is_active,
         -- Switching it back on forgives the run of failures that switched
         -- it off, otherwise one bad afternoon disables it forever.
         consecutive_failures = case when p_is_active then 0 else consecutive_failures end,
         disabled_at = case when p_is_active then null else now() end,
         disabled_reason = case when p_is_active then null else p_reason end,
         updated_at = now(),
         updated_by = public.current_user_id()
   where id = p_endpoint_id;

  return true;
end;
$$;

comment on function public.set_webhook_endpoint_state(uuid, boolean, text) is
  'Switches an endpoint on or off, clearing the failure run when it comes back.';

create or replace function public.delete_webhook_endpoint(p_endpoint_id uuid)
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
    from public.webhook_endpoints
   where id = p_endpoint_id
     and deleted_at is null;

  if v_company_id is null then
    return false;
  end if;

  if not (public.is_service_role() or public.is_company_owner(v_company_id)) then
    raise exception 'Only the account owner may change where this account sends data'
      using errcode = '42501';
  end if;

  update public.webhook_endpoints
     set is_active = false,
         deleted_at = now(),
         updated_at = now(),
         updated_by = public.current_user_id()
   where id = p_endpoint_id;

  return true;
end;
$$;

comment on function public.delete_webhook_endpoint(uuid) is
  'Stops sending to an endpoint, leaving its delivery history intact.';

-- -----------------------------------------------------------------------------
-- What the screen shows
-- -----------------------------------------------------------------------------

create or replace function public.webhook_endpoint_list(p_company_id uuid)
returns table (
  endpoint_id uuid,
  name text,
  target_url text,
  description text,
  subscribed_events text[],
  is_active boolean,
  secret_fingerprint text,
  secret_key_version smallint,
  consecutive_failures smallint,
  disabled_reason text,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  last_status_code smallint,
  pending_count integer,
  dead_letter_count integer
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not (public.is_service_role() or public.has_company_access(p_company_id)) then
    raise exception 'You cannot read where another business sends its data'
      using errcode = '42501';
  end if;

  return query
    select e.id,
           e.name,
           e.target_url,
           e.description,
           e.subscribed_events,
           e.is_active,
           -- The secret itself is never returned, only enough of its
           -- fingerprint to tell two apart.
           left(coalesce(e.signing_secret_fingerprint, ''), 12),
           e.secret_key_version,
           e.consecutive_failures,
           e.disabled_reason,
           e.last_success_at,
           e.last_failure_at,
           e.last_status_code,
           (select count(*) from public.webhook_deliveries as d
             where d.endpoint_id = e.id and d.status = 'pending')::int,
           (select count(*) from public.webhook_deliveries as d
             where d.endpoint_id = e.id and d.dead_lettered_at is not null)::int
      from public.webhook_endpoints as e
     where e.company_id = p_company_id
       and e.deleted_at is null
     order by e.created_at;
end;
$$;

comment on function public.webhook_endpoint_list(uuid) is
  'Lists where a business sends events, and how those deliveries are going.';

create or replace function public.webhook_delivery_history(
  p_company_id uuid,
  p_limit integer default 50
)
returns table (
  delivery_id uuid,
  endpoint_name text,
  event_type text,
  status public.webhook_delivery_status,
  attempt_count smallint,
  last_status_code smallint,
  last_error text,
  next_attempt_at timestamptz,
  delivered_at timestamptz,
  dead_lettered_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not (public.is_service_role() or public.has_company_access(p_company_id)) then
    raise exception 'You cannot read the deliveries of another business'
      using errcode = '42501';
  end if;

  return query
    select d.id,
           e.name,
           v.event_type,
           d.status,
           d.attempt_count,
           d.last_status_code,
           d.last_error,
           d.next_attempt_at,
           d.delivered_at,
           d.dead_lettered_at,
           d.created_at
      from public.webhook_deliveries as d
      join public.webhook_endpoints as e on e.id = d.endpoint_id
      left join public.outbound_events as v on v.id = d.event_id
     where d.company_id = p_company_id
     order by d.created_at desc
     limit greatest(coalesce(p_limit, 50), 1);
end;
$$;

comment on function public.webhook_delivery_history(uuid, integer) is
  'Lists recent deliveries with what went wrong and when the next try is.';

-- -----------------------------------------------------------------------------
-- Who may call what
-- -----------------------------------------------------------------------------

revoke execute on function public.save_webhook_endpoint(
  uuid, text, text, text[], text, text, text, uuid
) from public, authenticated;
revoke execute on function public.set_webhook_endpoint_state(uuid, boolean, text)
  from public, authenticated;
revoke execute on function public.delete_webhook_endpoint(uuid)
  from public, authenticated;
revoke execute on function public.webhook_endpoint_list(uuid)
  from public, authenticated;
revoke execute on function public.webhook_delivery_history(uuid, integer)
  from public, authenticated;

grant execute on function public.save_webhook_endpoint(
  uuid, text, text, text[], text, text, text, uuid
) to authenticated, service_role;
grant execute on function public.set_webhook_endpoint_state(uuid, boolean, text)
  to authenticated, service_role;
grant execute on function public.delete_webhook_endpoint(uuid)
  to authenticated, service_role;
grant execute on function public.webhook_endpoint_list(uuid)
  to authenticated, service_role;
grant execute on function public.webhook_delivery_history(uuid, integer)
  to authenticated, service_role;
