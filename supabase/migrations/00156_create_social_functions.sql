-- supabase/migrations/00156_create_social_functions.sql
-- Scheduling, publishing and measuring social content.

-- Schedules a post and fans it out to the channels it should reach. A post
-- with no channel is a draft nobody can publish, so that is refused here
-- rather than discovered by the worker later.
create or replace function public.schedule_social_post(
  p_post_id uuid,
  p_channel_ids uuid[],
  p_scheduled_for timestamptz
)
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_post public.social_posts%rowtype;
  v_channel_id uuid;
  v_count integer := 0;
begin
  select * into v_post
    from public.social_posts
   where id = p_post_id and deleted_at is null
     for update;

  if not found then
    raise exception 'That post does not exist' using errcode = 'P0002';
  end if;

  if not (public.is_service_role()
          or public.is_super_admin()
          or (v_post.company_id is not null
              and public.is_company_owner(v_post.company_id))) then
    raise exception 'Only an owner can schedule a post' using errcode = '42501';
  end if;

  if v_post.status not in ('draft', 'awaiting_approval', 'scheduled') then
    raise exception 'A post that has already gone out cannot be rescheduled'
      using errcode = '22023';
  end if;

  if coalesce(array_length(p_channel_ids, 1), 0) = 0 then
    raise exception 'A post needs at least one channel to go to'
      using errcode = '22023';
  end if;

  if p_scheduled_for < now() - interval '1 minute' then
    raise exception 'A post cannot be scheduled for a time that has passed'
      using errcode = '22023';
  end if;

  foreach v_channel_id in array p_channel_ids loop
    if not exists (
      select 1
        from public.social_channels as c
       where c.id = v_channel_id
         and c.company_id is not distinct from v_post.company_id
         and c.is_connected
         and c.is_active
         and c.deleted_at is null
    ) then
      raise exception 'One of those channels is not connected'
        using errcode = '22023';
    end if;

    insert into public.social_post_targets (
      post_id, channel_id, company_id, next_attempt_at
    )
    values (p_post_id, v_channel_id, v_post.company_id, p_scheduled_for)
    on conflict (post_id, channel_id) do update
       set next_attempt_at = excluded.next_attempt_at,
           status = 'pending',
           updated_at = now();

    v_count := v_count + 1;
  end loop;

  update public.social_posts
     set status = 'scheduled',
         scheduled_for = p_scheduled_for,
         updated_at = now()
   where id = p_post_id;

  return v_count;
end;
$$;

comment on function public.schedule_social_post(uuid, uuid[], timestamptz) is
  'Schedules a post and prepares it for each connected channel.';

-- Hands due posts to a publishing worker.
create or replace function public.claim_social_targets(
  p_worker_id text,
  p_limit integer default 10
)
returns setof public.social_post_targets
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  with due as (
    select t.id
      from public.social_post_targets as t
      join public.social_posts as p on p.id = t.post_id
     where t.status = 'pending'
       and t.next_attempt_at <= now()
       and p.status in ('scheduled', 'publishing')
       and p.deleted_at is null
     order by t.next_attempt_at
     limit greatest(coalesce(p_limit, 10), 1)
       for update of t skip locked
  )
  update public.social_post_targets as t
     set status = 'publishing',
         attempt_count = t.attempt_count + 1,
         updated_at = now()
    from due
   where t.id = due.id
  returning t.*;
end;
$$;

comment on function public.claim_social_targets(text, integer) is
  'Reserves the social posts that are due for one publishing worker.';

-- Records what the network said. A post is only called published once every
-- channel it was meant for has actually taken it.
create or replace function public.record_social_result(
  p_target_id uuid,
  p_succeeded boolean,
  p_external_post_id text default null,
  p_external_url text default null,
  p_error text default null
)
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_target public.social_post_targets%rowtype;
  v_pending integer;
  v_failed integer;
  v_published integer;
  v_status text;
begin
  select * into v_target
    from public.social_post_targets
   where id = p_target_id
     for update;

  if not found then
    raise exception 'That channel posting does not exist' using errcode = 'P0002';
  end if;

  if p_succeeded then
    update public.social_post_targets
       set status = 'published',
           published_at = now(),
           external_post_id = p_external_post_id,
           external_url = p_external_url,
           last_error = null,
           updated_at = now()
     where id = p_target_id;

    update public.social_channels
       set post_count = post_count + 1,
           last_published_at = now(),
           connection_error = null,
           updated_at = now()
     where id = v_target.channel_id;
  elsif v_target.attempt_count >= 5 then
    update public.social_post_targets
       set status = 'failed',
           last_error = left(coalesce(p_error, 'The network refused the post'), 500),
           updated_at = now()
     where id = p_target_id;
  else
    -- Five minutes, then doubling, capped at four hours.
    update public.social_post_targets
       set status = 'pending',
           next_attempt_at = now() + make_interval(
             secs => least(300 * power(2, v_target.attempt_count)::integer, 14400)
           ),
           last_error = left(coalesce(p_error, 'The network refused the post'), 500),
           updated_at = now()
     where id = p_target_id;
  end if;

  select count(*) filter (where status in ('pending', 'publishing')),
         count(*) filter (where status = 'failed'),
         count(*) filter (where status = 'published')
    into v_pending, v_failed, v_published
    from public.social_post_targets
   where post_id = v_target.post_id;

  v_status := case
    when v_pending > 0 then 'publishing'
    when v_published > 0 and v_failed > 0 then 'partially_published'
    when v_published > 0 then 'published'
    else 'failed'
  end;

  update public.social_posts
     set status = v_status,
         published_at = case
           when v_status in ('published', 'partially_published')
           then coalesce(published_at, now())
           else published_at
         end,
         updated_at = now()
   where id = v_target.post_id;

  return v_status;
end;
$$;

comment on function public.record_social_result(uuid, boolean, text, text, text) is
  'Records the outcome on one channel and works out the state of the post.';

-- Stores the figures a network reports back for a post.
create or replace function public.record_social_metrics(
  p_target_id uuid,
  p_impressions integer,
  p_engagements integer
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  update public.social_post_targets
     set impression_count = greatest(coalesce(p_impressions, 0), 0),
         engagement_count = greatest(coalesce(p_engagements, 0), 0),
         metrics_updated_at = now(),
         updated_at = now()
   where id = p_target_id
     and status = 'published';

  return found;
end;
$$;

comment on function public.record_social_metrics(uuid, integer, integer) is
  'Stores the impressions and engagements a network reported for a post.';

-- Turns something that happened in the product into a draft post, honouring
-- the quiet period so a busy day does not become a flood of posts.
create or replace function public.trigger_social_rules(
  p_company_id uuid,
  p_trigger_event text,
  p_substitutions jsonb default '{}'::jsonb
)
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_rule public.social_auto_rules%rowtype;
  v_body text;
  v_post_id uuid;
  v_created integer := 0;
  v_entry record;
begin
  for v_rule in
    select *
      from public.social_auto_rules
     where is_active
       and deleted_at is null
       and trigger_event = p_trigger_event
       and company_id is not distinct from p_company_id
  loop
    if v_rule.last_triggered_at is not null
       and v_rule.last_triggered_at
           > now() - make_interval(hours => v_rule.minimum_hours_between_posts) then
      continue;
    end if;

    v_body := v_rule.body_template;

    for v_entry in
      select key, value from jsonb_each_text(coalesce(p_substitutions, '{}'::jsonb))
    loop
      v_body := replace(v_body, '{{' || v_entry.key || '}}', v_entry.value);
    end loop;

    insert into public.social_posts (
      company_id, title, body, status, created_by_rule_id
    )
    values (
      p_company_id,
      left(v_rule.name, 120),
      v_body,
      case when v_rule.requires_approval then 'awaiting_approval' else 'draft' end,
      v_rule.id
    )
    returning id into v_post_id;

    update public.social_auto_rules
       set last_triggered_at = now(),
           trigger_count = trigger_count + 1,
           updated_at = now()
     where id = v_rule.id;

    v_created := v_created + 1;
  end loop;

  return v_created;
end;
$$;

comment on function public.trigger_social_rules(uuid, text, jsonb) is
  'Raises draft posts from the rules that match something that just happened.';

-- The calendar, as a month of content.
create or replace function public.social_calendar(
  p_company_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  post_id uuid,
  title text,
  status text,
  scheduled_for timestamptz,
  channel_count integer,
  published_count integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id,
         p.title,
         p.status,
         p.scheduled_for,
         (select count(*) from public.social_post_targets as t
           where t.post_id = p.id)::integer,
         (select count(*) from public.social_post_targets as t
           where t.post_id = p.id and t.status = 'published')::integer
    from public.social_posts as p
   where p.company_id is not distinct from p_company_id
     and p.deleted_at is null
     and coalesce(p.scheduled_for, p.created_at) between p_from and p_to
   order by coalesce(p.scheduled_for, p.created_at);
$$;

comment on function public.social_calendar(uuid, timestamptz, timestamptz) is
  'Returns the content planned for a period, with how much of it has gone out.';
