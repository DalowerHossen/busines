-- supabase/migrations/00135_create_approval_functions.sql
-- Raising, deciding and recording four eyes approvals.

-- Numbers a request the moment it is raised, in the same style as the rest of
-- the documents the platform issues.
create or replace function public.assign_approval_number()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_next integer;
begin
  if new.request_number is not null and btrim(new.request_number) <> '' then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'approval_requests:' || new.company_id::text, 0
  ));

  select coalesce(
           max(nullif(regexp_replace(request_number, '^AP-', ''), '')::integer),
           0
         ) + 1
    into v_next
    from public.approval_requests
   where company_id = new.company_id
     and request_number ~ '^AP-[0-9]+$';

  new.request_number := 'AP-' || lpad(v_next::text, 4, '0');

  return new;
end;
$$;

comment on function public.assign_approval_number() is
  'Gives a new approval request its sequential number.';

-- Raises a request. The caller stores whatever the action needs in the
-- payload, and nothing is carried out until somebody else agrees.
create or replace function public.request_approval(
  p_company_id uuid,
  p_action_type text,
  p_title text,
  p_payload jsonb default '{}'::jsonb,
  p_amount numeric default null,
  p_currency_code char(3) default null,
  p_entity_type text default null,
  p_entity_id uuid default null,
  p_reason text default null,
  p_required_approvals smallint default 1,
  p_expires_in_hours integer default 168
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_user uuid;
begin
  if not (public.is_service_role() or public.has_company_access(p_company_id)) then
    raise exception 'You cannot raise an approval request for this company'
      using errcode = '42501';
  end if;

  v_user := public.current_user_id();

  if v_user is null then
    raise exception 'An approval request must record who asked for it'
      using errcode = '22023';
  end if;

  insert into public.approval_requests (
    company_id, action_type, title, payload, amount, currency_code,
    entity_type, entity_id, reason, required_approvals, requested_by,
    expires_at
  )
  values (
    p_company_id, p_action_type, p_title, coalesce(p_payload, '{}'::jsonb),
    p_amount, p_currency_code, p_entity_type, p_entity_id, p_reason,
    greatest(coalesce(p_required_approvals, 1), 1), v_user,
    case
      when p_expires_in_hours is null then null
      else now() + make_interval(hours => p_expires_in_hours)
    end
  )
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.request_approval(
  uuid, text, text, jsonb, numeric, char, text, uuid, text, smallint, integer
) is 'Raises an action that needs a second person to agree to it.';

-- Records one answer. The requester is refused, which is the whole point of
-- four eyes, and a rejection ends the request immediately.
create or replace function public.decide_approval(
  p_request_id uuid,
  p_decision text,
  p_note text default null,
  p_ip_hash text default null
)
returns public.approval_status
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.approval_requests%rowtype;
  v_user uuid;
  v_received smallint;
  v_status public.approval_status;
begin
  if p_decision not in ('approved', 'rejected') then
    raise exception 'A decision is either approved or rejected'
      using errcode = '22023';
  end if;

  select * into v_request
    from public.approval_requests
   where id = p_request_id
     and deleted_at is null
     for update;

  if not found then
    raise exception 'That approval request does not exist'
      using errcode = 'P0002';
  end if;

  if v_request.status <> 'pending' then
    raise exception 'That approval request has already been decided'
      using errcode = '22023';
  end if;

  if v_request.expires_at is not null and v_request.expires_at <= now() then
    raise exception 'That approval request has expired'
      using errcode = '22023';
  end if;

  v_user := public.current_user_id();

  if not (public.is_service_role()
          or public.is_company_owner(v_request.company_id)
          or public.is_super_admin()) then
    raise exception 'Only an owner can decide an approval request'
      using errcode = '42501';
  end if;

  if v_user is not null and v_user = v_request.requested_by then
    raise exception 'The person who asked cannot also approve'
      using errcode = '42501';
  end if;

  insert into public.approval_decisions (
    company_id, approval_request_id, decided_by, decision, note, ip_hash
  )
  values (
    v_request.company_id, v_request.id, v_user, p_decision, p_note, p_ip_hash
  );

  if p_decision = 'rejected' then
    v_status := 'rejected';
    v_received := v_request.approvals_received;
  else
    v_received := v_request.approvals_received + 1;
    v_status := case
      when v_received >= v_request.required_approvals then 'approved'
      else 'pending'
    end;
  end if;

  update public.approval_requests
     set approvals_received = v_received,
         status = v_status,
         decided_by = case when v_status = 'pending' then null else v_user end,
         decided_at = case when v_status = 'pending' then null else now() end,
         decision_note = case when v_status = 'pending' then null else p_note end,
         updated_at = now()
   where id = v_request.id;

  return v_status;
end;
$$;

comment on function public.decide_approval(uuid, text, text, text) is
  'Records one approval or rejection and closes the request when it is settled.';

-- Marks an approved request as carried out, so the action cannot run twice.
create or replace function public.complete_approved_action(
  p_request_id uuid,
  p_result jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.approval_requests%rowtype;
begin
  select * into v_request
    from public.approval_requests
   where id = p_request_id
     and deleted_at is null
     for update;

  if not found then
    raise exception 'That approval request does not exist'
      using errcode = 'P0002';
  end if;

  if v_request.status <> 'approved' then
    raise exception 'Only an approved request can be carried out'
      using errcode = '22023';
  end if;

  if v_request.executed_at is not null then
    return false;
  end if;

  update public.approval_requests
     set executed_at = now(),
         execution_result = coalesce(p_result, '{}'::jsonb),
         updated_at = now()
   where id = v_request.id;

  return true;
end;
$$;

comment on function public.complete_approved_action(uuid, jsonb) is
  'Marks an approved action as done so it can never be carried out twice.';

-- Lets a request that nobody answered fall away on its own.
create or replace function public.expire_stale_approvals()
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  with expired as (
    update public.approval_requests
       set status = 'cancelled',
           decided_at = now(),
           decision_note = 'Expired before anybody answered',
           updated_at = now()
     where status = 'pending'
       and expires_at is not null
       and expires_at <= now()
       and deleted_at is null
    returning 1
  )
  select count(*)::int into v_count from expired;

  return v_count;
end;
$$;

comment on function public.expire_stale_approvals() is
  'Cancels approval requests that nobody answered in time.';

-- -----------------------------------------------------------------------------
-- Sensitive reads
-- -----------------------------------------------------------------------------

-- Called the moment protected data is shown to somebody.
create or replace function public.record_sensitive_access(
  p_company_id uuid,
  p_resource_type text,
  p_resource_id uuid default null,
  p_field_name text default null,
  p_purpose text default null,
  p_ip_hash text default null,
  p_user_agent text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  insert into public.sensitive_access_logs (
    company_id, accessed_by, access_role, resource_type, resource_id,
    field_name, purpose, ip_hash, user_agent
  )
  values (
    p_company_id,
    public.current_user_id(),
    public.current_user_role(),
    p_resource_type,
    p_resource_id,
    p_field_name,
    p_purpose,
    p_ip_hash,
    left(coalesce(p_user_agent, ''), 500)
  )
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.record_sensitive_access(
  uuid, text, uuid, text, text, text, text
) is 'Records that somebody read protected personal or financial data.';

-- What one tenant has looked at lately, for the owner and for an auditor.
create or replace function public.sensitive_access_report(
  p_company_id uuid,
  p_from timestamptz default (now() - interval '30 days'),
  p_to timestamptz default now()
)
returns table (
  resource_type text,
  field_name text,
  access_count integer,
  distinct_viewers integer,
  last_accessed_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select l.resource_type,
         l.field_name,
         count(*)::int as access_count,
         count(distinct l.accessed_by)::int as distinct_viewers,
         max(l.accessed_at) as last_accessed_at
    from public.sensitive_access_logs l
   where l.company_id = p_company_id
     and l.accessed_at >= p_from
     and l.accessed_at <= p_to
   group by l.resource_type, l.field_name
   order by access_count desc, l.resource_type;
$$;

comment on function public.sensitive_access_report(uuid, timestamptz, timestamptz) is
  'Summarises which protected fields were read, how often and by how many people.';
