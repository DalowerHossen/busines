-- supabase/migrations/00190_create_estimate_lifecycle.sql
-- The working life of an estimate: sending it, hearing back, and closing it.
--
-- An estimate carries no statutory weight, so it is never locked the way an
-- invoice is. It does, however, take a number when it leaves the building, and
-- the client identity is frozen at that moment so a later edit to the client
-- record cannot rewrite what was quoted.

-- Assigns the number, freezes the client identity and marks the estimate sent.
create or replace function public.issue_estimate(
  p_estimate_id uuid,
  p_issue_date date default current_date
)
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_estimate public.estimates%rowtype;
  v_profile public.company_profiles%rowtype;
  v_client public.clients%rowtype;
  v_address public.client_addresses%rowtype;
  v_snapshot_id uuid;
  v_number text;
  v_item_count integer;
begin
  select * into v_estimate
    from public.estimates
   where id = p_estimate_id and deleted_at is null;

  if not found then
    raise exception 'Estimate % was not found', p_estimate_id using errcode = 'P0002';
  end if;

  if not public.can_write_company_data(v_estimate.company_id) then
    raise exception 'You are not allowed to send estimates for this company'
      using errcode = '42501';
  end if;

  if v_estimate.status <> 'draft' then
    raise exception 'Estimate % has already been sent', p_estimate_id
      using errcode = '42501';
  end if;

  select count(*) into v_item_count
    from public.estimate_items
   where estimate_id = p_estimate_id and deleted_at is null;

  if v_item_count = 0 then
    raise exception 'An estimate must contain at least one line before it is sent'
      using errcode = '22023';
  end if;

  select * into v_profile
    from public.company_profiles
   where company_id = v_estimate.company_id and deleted_at is null;

  select * into v_client
    from public.clients
   where id = v_estimate.client_id and deleted_at is null;

  select * into v_address
    from public.client_addresses
   where client_id = v_estimate.client_id
     and address_type = 'billing'
     and deleted_at is null
   order by is_default desc, created_at asc
   limit 1;

  v_snapshot_id := public.capture_company_profile_snapshot(v_estimate.company_id);

  v_number := coalesce(
    v_estimate.estimate_number,
    public.next_document_number(
      v_estimate.company_id,
      'estimate',
      coalesce(v_profile.estimate_prefix, 'EST-'),
      coalesce(v_profile.number_padding, 4)::smallint,
      coalesce(v_profile.numbering_reset_policy, 'never'),
      null::text,
      p_issue_date
    )
  );

  update public.estimates
     set estimate_number = v_number,
         status = 'sent',
         issue_date = p_issue_date,
         valid_until = greatest(
           coalesce(valid_until, p_issue_date + 30), p_issue_date
         ),
         sent_at = now(),
         company_profile_snapshot_id = v_snapshot_id,
         client_name_snapshot = coalesce(v_client.legal_name, v_client.display_name),
         bill_to = jsonb_strip_nulls(jsonb_build_object(
           'name', coalesce(v_client.legal_name, v_client.display_name),
           'attention_to', v_address.attention_to,
           'email', v_client.email::text,
           'phone', v_client.phone,
           'tax_id', coalesce(v_client.vat_number, v_client.tax_id),
           'address_line1', v_address.address_line1,
           'address_line2', v_address.address_line2,
           'city', v_address.city,
           'state_region', v_address.state_region,
           'postal_code', v_address.postal_code,
           'country_code', coalesce(v_address.country_code, v_client.country_code)
         )),
         updated_at = now()
   where id = p_estimate_id;

  insert into public.document_events (
    company_id, document_kind, document_id, event_type, actor_user_id, detail
  )
  values (
    v_estimate.company_id,
    'estimate',
    p_estimate_id,
    'sent',
    public.current_user_id(),
    jsonb_build_object('estimate_number', v_number)
  );

  return v_number;
end;
$$;

comment on function public.issue_estimate(uuid, date) is
  'Numbers an estimate, freezes the client identity and marks it as sent.';

-- Records that the client accepted the quotation.
create or replace function public.approve_estimate(
  p_estimate_id uuid,
  p_approved_by_name text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_estimate public.estimates%rowtype;
begin
  select * into v_estimate
    from public.estimates
   where id = p_estimate_id and deleted_at is null;

  if not found then
    raise exception 'Estimate % was not found', p_estimate_id using errcode = 'P0002';
  end if;

  if not public.can_write_company_data(v_estimate.company_id) then
    raise exception 'You are not allowed to change estimates for this company'
      using errcode = '42501';
  end if;

  if v_estimate.status not in ('sent', 'viewed', 'expired', 'declined') then
    raise exception 'Only an estimate that has gone out can be approved'
      using errcode = '42501';
  end if;

  update public.estimates
     set status = 'approved',
         approved_at = now(),
         approved_by_name = coalesce(p_approved_by_name, approved_by_name),
         declined_at = null,
         decline_reason = null,
         updated_at = now()
   where id = p_estimate_id;

  insert into public.document_events (
    company_id, document_kind, document_id, event_type, actor_user_id, detail
  )
  values (
    v_estimate.company_id,
    'estimate',
    p_estimate_id,
    'approved',
    public.current_user_id(),
    jsonb_strip_nulls(jsonb_build_object('approved_by', p_approved_by_name))
  );
end;
$$;

comment on function public.approve_estimate(uuid, text) is
  'Marks an estimate as accepted by the client.';

-- Records that the client turned the quotation down.
create or replace function public.decline_estimate(
  p_estimate_id uuid,
  p_reason text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_estimate public.estimates%rowtype;
begin
  select * into v_estimate
    from public.estimates
   where id = p_estimate_id and deleted_at is null;

  if not found then
    raise exception 'Estimate % was not found', p_estimate_id using errcode = 'P0002';
  end if;

  if not public.can_write_company_data(v_estimate.company_id) then
    raise exception 'You are not allowed to change estimates for this company'
      using errcode = '42501';
  end if;

  if v_estimate.status in ('converted', 'cancelled') then
    raise exception 'This estimate is closed and can no longer be declined'
      using errcode = '42501';
  end if;

  update public.estimates
     set status = 'declined',
         declined_at = now(),
         decline_reason = p_reason,
         approved_at = null,
         updated_at = now()
   where id = p_estimate_id;

  insert into public.document_events (
    company_id, document_kind, document_id, event_type, actor_user_id, detail
  )
  values (
    v_estimate.company_id,
    'estimate',
    p_estimate_id,
    'declined',
    public.current_user_id(),
    jsonb_strip_nulls(jsonb_build_object('reason', p_reason))
  );
end;
$$;

comment on function public.decline_estimate(uuid, text) is
  'Marks an estimate as turned down, keeping the reason on record.';

-- Withdraws an estimate that will not be pursued.
create or replace function public.cancel_estimate(
  p_estimate_id uuid,
  p_reason text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_estimate public.estimates%rowtype;
begin
  select * into v_estimate
    from public.estimates
   where id = p_estimate_id and deleted_at is null;

  if not found then
    raise exception 'Estimate % was not found', p_estimate_id using errcode = 'P0002';
  end if;

  if not public.can_write_company_data(v_estimate.company_id) then
    raise exception 'You are not allowed to change estimates for this company'
      using errcode = '42501';
  end if;

  if v_estimate.status = 'converted' then
    raise exception 'An estimate that became an invoice can no longer be withdrawn'
      using errcode = '42501';
  end if;

  update public.estimates
     set status = 'cancelled',
         decline_reason = coalesce(p_reason, decline_reason),
         updated_at = now()
   where id = p_estimate_id;

  insert into public.document_events (
    company_id, document_kind, document_id, event_type, actor_user_id, detail
  )
  values (
    v_estimate.company_id,
    'estimate',
    p_estimate_id,
    'link_revoked',
    public.current_user_id(),
    jsonb_strip_nulls(jsonb_build_object('reason', p_reason))
  );
end;
$$;

comment on function public.cancel_estimate(uuid, text) is
  'Withdraws an estimate so it can no longer be accepted.';

grant execute on function public.issue_estimate(uuid, date) to authenticated;
grant execute on function public.approve_estimate(uuid, text) to authenticated;
grant execute on function public.decline_estimate(uuid, text) to authenticated;
grant execute on function public.cancel_estimate(uuid, text) to authenticated;
