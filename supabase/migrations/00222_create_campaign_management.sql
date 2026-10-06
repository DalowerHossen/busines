-- supabase/migrations/00222_create_campaign_management.sql
-- Writing a campaign, choosing who gets it, and sending it.
--
-- The sending machinery exists already: an audience is built, recipients are
-- claimed in batches, outcomes are recorded, sequences advance on their own.
-- What was missing is everything a person does before any of that, and the
-- rules that stop a marketing tool from becoming a liability.
--
-- Three of those rules are enforced here. A campaign cannot be scheduled
-- without a subject and something to say, because an empty send cannot be
-- unsent. A campaign that has started cannot be rewritten, because the
-- recipients of the first half would have read something different from the
-- second. And an audience is only ever people who agreed to hear from this
-- business; that is checked when the audience is built, not when somebody
-- remembers.

create or replace function public.save_marketing_segment(
  p_company_id uuid,
  p_name text,
  p_description text default null,
  p_criteria jsonb default '{}'::jsonb,
  p_segment_id uuid default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_segment_id uuid;
begin
  if not (public.is_service_role()
          or (p_company_id is null and public.is_super_admin())
          or (p_company_id is not null
              and public.can_write_company_data(p_company_id))) then
    raise exception 'You are not allowed to describe audiences for this business'
      using errcode = '42501';
  end if;

  if p_segment_id is null then
    insert into public.marketing_segments (
      company_id, name, description, criteria, created_by, updated_by
    )
    values (
      p_company_id, btrim(p_name),
      nullif(btrim(coalesce(p_description, '')), ''),
      coalesce(p_criteria, '{}'::jsonb),
      public.current_user_id(), public.current_user_id()
    )
    returning id into v_segment_id;

    return v_segment_id;
  end if;

  update public.marketing_segments
     set name = btrim(p_name),
         description = case
                         when p_description is null then description
                         else nullif(btrim(p_description), '')
                       end,
         criteria = coalesce(p_criteria, criteria),
         updated_at = now(),
         updated_by = public.current_user_id()
   where id = p_segment_id
     and deleted_at is null;

  if not found then
    raise exception 'That audience was not found' using errcode = 'P0002';
  end if;

  return p_segment_id;
end;
$$;

comment on function public.save_marketing_segment(uuid, text, text, jsonb, uuid) is
  'Describes an audience, which is recalculated on a schedule rather than on demand.';

create or replace function public.save_marketing_campaign(
  p_company_id uuid,
  p_name text,
  p_subject text,
  p_body_markdown text,
  p_campaign_type text default 'broadcast',
  p_segment_id uuid default null,
  p_preheader text default null,
  p_from_name text default null,
  p_utm_campaign text default null,
  p_campaign_id uuid default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_campaign_id uuid;
  v_status text;
begin
  if not (public.is_service_role()
          or (p_company_id is null and public.is_super_admin())
          or (p_company_id is not null
              and public.can_write_company_data(p_company_id))) then
    raise exception 'You are not allowed to write campaigns for this business'
      using errcode = '42501';
  end if;

  if p_campaign_id is null then
    insert into public.marketing_campaigns (
      company_id, name, campaign_type, segment_id, subject, preheader,
      body_markdown, from_name, utm_campaign, status, created_by, updated_by
    )
    values (
      p_company_id, btrim(p_name), coalesce(p_campaign_type, 'broadcast'),
      p_segment_id, btrim(p_subject), nullif(btrim(coalesce(p_preheader, '')), ''),
      p_body_markdown, nullif(btrim(coalesce(p_from_name, '')), ''),
      nullif(btrim(coalesce(p_utm_campaign, '')), ''), 'draft',
      public.current_user_id(), public.current_user_id()
    )
    returning id into v_campaign_id;

    return v_campaign_id;
  end if;

  select status into v_status
    from public.marketing_campaigns
   where id = p_campaign_id
     and deleted_at is null;

  if v_status is null then
    raise exception 'That campaign was not found' using errcode = 'P0002';
  end if;

  -- Half the audience has already read the old wording. Changing it now
  -- would mean two different campaigns under one name.
  if v_status in ('sending', 'sent') then
    raise exception 'A campaign that has started cannot be rewritten'
      using errcode = '22023';
  end if;

  update public.marketing_campaigns
     set name = btrim(p_name),
         subject = btrim(p_subject),
         body_markdown = p_body_markdown,
         campaign_type = coalesce(p_campaign_type, campaign_type),
         segment_id = coalesce(p_segment_id, segment_id),
         preheader = case
                       when p_preheader is null then preheader
                       else nullif(btrim(p_preheader), '')
                     end,
         from_name = case
                       when p_from_name is null then from_name
                       else nullif(btrim(p_from_name), '')
                     end,
         utm_campaign = coalesce(nullif(btrim(coalesce(p_utm_campaign, '')), ''), utm_campaign),
         updated_at = now(),
         updated_by = public.current_user_id()
   where id = p_campaign_id;

  return p_campaign_id;
end;
$$;

comment on function public.save_marketing_campaign(
  uuid, text, text, text, text, uuid, text, text, text, uuid
) is 'Writes a campaign, refusing to rewrite one the audience has already started reading.';

create or replace function public.schedule_marketing_campaign(
  p_campaign_id uuid,
  p_scheduled_for timestamptz
)
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_campaign public.marketing_campaigns%rowtype;
  v_audience integer;
begin
  select * into v_campaign
    from public.marketing_campaigns
   where id = p_campaign_id
     and deleted_at is null
     for update;

  if not found then
    raise exception 'That campaign was not found' using errcode = 'P0002';
  end if;

  if not (public.is_service_role()
          or (v_campaign.company_id is null and public.is_super_admin())
          or (v_campaign.company_id is not null
              and public.is_company_owner(v_campaign.company_id))) then
    raise exception 'Only an owner may send a campaign to clients'
      using errcode = '42501';
  end if;

  if v_campaign.status not in ('draft', 'paused', 'scheduled') then
    raise exception 'That campaign is already on its way' using errcode = '22023';
  end if;

  if coalesce(btrim(v_campaign.subject), '') = ''
     or coalesce(btrim(v_campaign.body_markdown), '') = '' then
    raise exception 'A campaign needs a subject and something to say'
      using errcode = '22023';
  end if;

  if p_scheduled_for < now() - interval '5 minutes' then
    raise exception 'A campaign cannot be scheduled for a time that has passed'
      using errcode = '22023';
  end if;

  -- The audience is built now rather than at send time, so the person
  -- pressing the button can see how many people this reaches.
  v_audience := public.build_campaign_audience(p_campaign_id);

  update public.marketing_campaigns
     set status = 'scheduled',
         scheduled_for = p_scheduled_for,
         updated_at = now(),
         updated_by = public.current_user_id()
   where id = p_campaign_id;

  return v_audience;
end;
$$;

comment on function public.schedule_marketing_campaign(uuid, timestamptz) is
  'Gives a campaign a time, after building the audience so the size is known first.';

create or replace function public.pause_marketing_campaign(p_campaign_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_campaign public.marketing_campaigns%rowtype;
begin
  select * into v_campaign
    from public.marketing_campaigns
   where id = p_campaign_id
     and deleted_at is null
     for update;

  if not found then
    return false;
  end if;

  if not (public.is_service_role()
          or (v_campaign.company_id is null and public.is_super_admin())
          or (v_campaign.company_id is not null
              and public.is_company_owner(v_campaign.company_id))) then
    raise exception 'Only an owner may stop a campaign' using errcode = '42501';
  end if;

  if v_campaign.status = 'sent' then
    raise exception 'That campaign has already gone out' using errcode = '22023';
  end if;

  update public.marketing_campaigns
     set status = 'paused',
         updated_at = now(),
         updated_by = public.current_user_id()
   where id = p_campaign_id;

  -- Anybody who has not been written to yet is passed over rather than
  -- deleted, so the record still shows who would have received this.
  update public.campaign_recipients
     set status = 'skipped'
   where campaign_id = p_campaign_id
     and status = 'pending';

  return true;
end;
$$;

comment on function public.pause_marketing_campaign(uuid) is
  'Stops a campaign and takes everybody not yet written to out of the queue.';

create or replace function public.save_campaign_step(
  p_campaign_id uuid,
  p_step_number integer,
  p_name text,
  p_subject text,
  p_body_markdown text,
  p_delay_hours integer default 24,
  p_step_id uuid default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_campaign public.marketing_campaigns%rowtype;
  v_step_id uuid;
begin
  select * into v_campaign
    from public.marketing_campaigns
   where id = p_campaign_id
     and deleted_at is null;

  if not found then
    raise exception 'That campaign was not found' using errcode = 'P0002';
  end if;

  if not (public.is_service_role()
          or (v_campaign.company_id is null and public.is_super_admin())
          or (v_campaign.company_id is not null
              and public.can_write_company_data(v_campaign.company_id))) then
    raise exception 'You are not allowed to write campaigns for this business'
      using errcode = '42501';
  end if;

  if v_campaign.status in ('sending', 'sent') then
    raise exception 'The steps of a running sequence cannot be changed'
      using errcode = '22023';
  end if;

  if p_step_id is null then
    insert into public.campaign_steps (
      campaign_id, company_id, step_number, name, subject, body_markdown, delay_hours
    )
    values (
      p_campaign_id, v_campaign.company_id, p_step_number::smallint, btrim(p_name),
      btrim(p_subject), p_body_markdown, coalesce(p_delay_hours, 24)
    )
    returning id into v_step_id;

    return v_step_id;
  end if;

  update public.campaign_steps
     set step_number = p_step_number::smallint,
         name = btrim(p_name),
         subject = btrim(p_subject),
         body_markdown = p_body_markdown,
         delay_hours = coalesce(p_delay_hours, delay_hours),
         updated_at = now()
   where id = p_step_id;

  return p_step_id;
end;
$$;

comment on function public.save_campaign_step(
  uuid, integer, text, text, text, integer, uuid
) is 'Adds or edits one message in a sequence, while the sequence is still idle.';

-- -----------------------------------------------------------------------------
-- What the screen shows
-- -----------------------------------------------------------------------------

create or replace function public.marketing_overview(p_company_id uuid default null)
returns table (
  campaign_id uuid,
  name text,
  campaign_type text,
  status text,
  subject text,
  segment_name text,
  scheduled_for timestamptz,
  recipient_count integer,
  delivered_count integer,
  opened_count integer,
  clicked_count integer,
  unsubscribed_count integer,
  open_rate numeric,
  click_rate numeric,
  step_count integer,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if p_company_id is null then
    if not (public.is_service_role() or public.is_super_admin()) then
      raise exception 'Only the platform team may read the platform campaigns'
        using errcode = '42501';
    end if;
  elsif not (public.is_service_role() or public.has_company_access(p_company_id)) then
    raise exception 'You cannot read the campaigns of another business'
      using errcode = '42501';
  end if;

  return query
    select c.id,
           c.name,
           c.campaign_type,
           c.status,
           c.subject,
           s.name,
           c.scheduled_for,
           c.recipient_count,
           c.delivered_count,
           c.opened_count,
           c.clicked_count,
           c.unsubscribed_count,
           case when c.delivered_count > 0
                then round(c.opened_count * 100.0 / c.delivered_count, 1)
                else 0 end,
           case when c.delivered_count > 0
                then round(c.clicked_count * 100.0 / c.delivered_count, 1)
                else 0 end,
           (select count(*) from public.campaign_steps as t
             where t.campaign_id = c.id)::int,
           c.updated_at
      from public.marketing_campaigns as c
      left join public.marketing_segments as s on s.id = c.segment_id
     where c.company_id is not distinct from p_company_id
       and c.deleted_at is null
     order by coalesce(c.scheduled_for, c.updated_at) desc;
end;
$$;

comment on function public.marketing_overview(uuid) is
  'Lists the campaigns of one business with what each one actually achieved.';

create or replace function public.marketing_segment_list(p_company_id uuid default null)
returns table (
  segment_id uuid,
  name text,
  description text,
  member_count integer,
  last_calculated_at timestamptz,
  is_active boolean
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if p_company_id is null then
    if not (public.is_service_role() or public.is_super_admin()) then
      raise exception 'Only the platform team may read the platform audiences'
        using errcode = '42501';
    end if;
  elsif not (public.is_service_role() or public.has_company_access(p_company_id)) then
    raise exception 'You cannot read the audiences of another business'
      using errcode = '42501';
  end if;

  return query
    select s.id, s.name, s.description, s.member_count, s.last_calculated_at, s.is_active
      from public.marketing_segments as s
     where s.company_id is not distinct from p_company_id
       and s.deleted_at is null
     order by s.name;
end;
$$;

comment on function public.marketing_segment_list(uuid) is
  'Lists the described audiences of one business and how large each one was.';

-- How many people this business may lawfully write to at all. A marketing
-- list is only ever the people who said yes.
create or replace function public.marketing_reach(p_company_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_subscribed integer;
  v_unsubscribed integer;
  v_clients integer;
begin
  if not (public.is_service_role() or public.has_company_access(p_company_id)) then
    raise exception 'You cannot read the audience of another business'
      using errcode = '42501';
  end if;

  select count(*) filter (where is_subscribed),
         count(*) filter (where not is_subscribed)
    into v_subscribed, v_unsubscribed
    from public.marketing_subscriptions
   where company_id = p_company_id;

  select count(*) into v_clients
    from public.clients
   where company_id = p_company_id
     and deleted_at is null;

  return jsonb_build_object(
    'subscribed', coalesce(v_subscribed, 0),
    'unsubscribed', coalesce(v_unsubscribed, 0),
    'client_count', coalesce(v_clients, 0)
  );
end;
$$;

comment on function public.marketing_reach(uuid) is
  'Counts the people who agreed to hear from this business, and those who asked not to.';

-- -----------------------------------------------------------------------------
-- Who may call what
-- -----------------------------------------------------------------------------

revoke execute on function public.save_marketing_segment(uuid, text, text, jsonb, uuid)
  from public, authenticated;
revoke execute on function public.save_marketing_campaign(
  uuid, text, text, text, text, uuid, text, text, text, uuid
) from public, authenticated;
revoke execute on function public.schedule_marketing_campaign(uuid, timestamptz)
  from public, authenticated;
revoke execute on function public.pause_marketing_campaign(uuid)
  from public, authenticated;
revoke execute on function public.save_campaign_step(
  uuid, integer, text, text, text, integer, uuid
) from public, authenticated;
revoke execute on function public.marketing_overview(uuid)
  from public, authenticated;
revoke execute on function public.marketing_segment_list(uuid)
  from public, authenticated;
revoke execute on function public.marketing_reach(uuid)
  from public, authenticated;

grant execute on function public.save_marketing_segment(uuid, text, text, jsonb, uuid)
  to authenticated, service_role;
grant execute on function public.save_marketing_campaign(
  uuid, text, text, text, text, uuid, text, text, text, uuid
) to authenticated, service_role;
grant execute on function public.schedule_marketing_campaign(uuid, timestamptz)
  to authenticated, service_role;
grant execute on function public.pause_marketing_campaign(uuid)
  to authenticated, service_role;
grant execute on function public.save_campaign_step(
  uuid, integer, text, text, text, integer, uuid
) to authenticated, service_role;
grant execute on function public.marketing_overview(uuid)
  to authenticated, service_role;
grant execute on function public.marketing_segment_list(uuid)
  to authenticated, service_role;
grant execute on function public.marketing_reach(uuid)
  to authenticated, service_role;
