-- supabase/migrations/00224_create_experiment_management.sql
-- Writing down a test before it is run, and reading it honestly after.
--
-- The machinery for splitting traffic already exists. What was missing is
-- the part that keeps a test from being self deception: the hypothesis has
-- to be written before the test starts, the variants have to add up to the
-- whole of the traffic, and a running test cannot have its wording changed
-- underneath the people already in it.
--
-- The last rule is the important one. Editing a variant that has already
-- been shown to four thousand visitors does not give you a better test; it
-- gives you a number that means nothing and a decision made on it.

create or replace function public.save_experiment(
  p_key text,
  p_name text,
  p_goal_event_name text,
  p_hypothesis text default null,
  p_surface text default 'landing_page',
  p_traffic_percentage integer default 100,
  p_experiment_id uuid default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_experiment_id uuid;
  v_status text;
begin
  if not (public.is_service_role() or public.is_super_admin()) then
    raise exception 'Only the platform team may run tests on the public site'
      using errcode = '42501';
  end if;

  if coalesce(p_traffic_percentage, 100) not between 1 and 100 then
    raise exception 'A test runs on between one and a hundred percent of visitors'
      using errcode = '22023';
  end if;

  if p_experiment_id is null then
    insert into public.experiments (
      key, name, hypothesis, surface, goal_event_name, traffic_percentage,
      status, created_by, updated_by
    )
    values (
      lower(btrim(p_key)), btrim(p_name),
      nullif(btrim(coalesce(p_hypothesis, '')), ''),
      coalesce(p_surface, 'landing_page'), btrim(p_goal_event_name),
      coalesce(p_traffic_percentage, 100)::smallint, 'draft',
      public.current_user_id(), public.current_user_id()
    )
    returning id into v_experiment_id;

    return v_experiment_id;
  end if;

  select status into v_status
    from public.experiments
   where id = p_experiment_id
     and deleted_at is null;

  if v_status is null then
    raise exception 'That test was not found' using errcode = 'P0002';
  end if;

  -- People are already in it. Changing what is being tested now would make
  -- the result describe two different tests added together.
  if v_status = 'running' then
    raise exception 'A test that is running cannot be rewritten. Stop it first'
      using errcode = '22023';
  end if;

  update public.experiments
     set name = btrim(p_name),
         hypothesis = case
                        when p_hypothesis is null then hypothesis
                        else nullif(btrim(p_hypothesis), '')
                      end,
         goal_event_name = btrim(p_goal_event_name),
         surface = coalesce(p_surface, surface),
         traffic_percentage = coalesce(p_traffic_percentage, traffic_percentage)::smallint,
         updated_at = now(),
         updated_by = public.current_user_id()
   where id = p_experiment_id;

  return p_experiment_id;
end;
$$;

comment on function public.save_experiment(
  text, text, text, text, text, integer, uuid
) is 'Writes down a test, refusing to rewrite one that people are already in.';

create or replace function public.save_experiment_variant(
  p_experiment_id uuid,
  p_key text,
  p_name text,
  p_weight integer default 50,
  p_is_control boolean default false,
  p_overrides jsonb default '{}'::jsonb,
  p_variant_id uuid default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
  v_variant_id uuid;
begin
  if not (public.is_service_role() or public.is_super_admin()) then
    raise exception 'Only the platform team may run tests on the public site'
      using errcode = '42501';
  end if;

  select status into v_status
    from public.experiments
   where id = p_experiment_id
     and deleted_at is null;

  if v_status is null then
    raise exception 'That test was not found' using errcode = 'P0002';
  end if;

  if v_status = 'running' then
    raise exception 'The variants of a running test cannot be changed'
      using errcode = '22023';
  end if;

  if coalesce(p_weight, 50) not between 1 and 100 then
    raise exception 'A variant takes between one and a hundred percent of the traffic'
      using errcode = '22023';
  end if;

  -- Exactly one variant is the thing being compared against.
  if coalesce(p_is_control, false) then
    update public.experiment_variants
       set is_control = false, updated_at = now()
     where experiment_id = p_experiment_id
       and (p_variant_id is null or id <> p_variant_id);
  end if;

  if p_variant_id is null then
    insert into public.experiment_variants (
      experiment_id, key, name, weight, is_control, overrides
    )
    values (
      p_experiment_id, lower(btrim(p_key)), btrim(p_name),
      coalesce(p_weight, 50)::smallint, coalesce(p_is_control, false),
      coalesce(p_overrides, '{}'::jsonb)
    )
    returning id into v_variant_id;

    return v_variant_id;
  end if;

  update public.experiment_variants
     set key = lower(btrim(p_key)),
         name = btrim(p_name),
         weight = coalesce(p_weight, weight)::smallint,
         is_control = coalesce(p_is_control, is_control),
         overrides = coalesce(p_overrides, overrides),
         updated_at = now()
   where id = p_variant_id;

  return p_variant_id;
end;
$$;

comment on function public.save_experiment_variant(
  uuid, text, text, integer, boolean, jsonb, uuid
) is 'Adds or edits one side of a test, while nobody is in it yet.';

-- What the console shows: every test, what it is asking, and how it is
-- doing so far.
create or replace function public.experiment_list()
returns table (
  experiment_id uuid,
  key text,
  name text,
  hypothesis text,
  goal_event_name text,
  surface text,
  status text,
  traffic_percentage smallint,
  variant_count integer,
  total_assignments integer,
  total_conversions integer,
  started_at timestamptz,
  conclusion text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not (public.is_service_role() or public.is_super_admin()) then
    raise exception 'Only the platform team may read the tests' using errcode = '42501';
  end if;

  return query
    select e.id,
           e.key,
           e.name,
           e.hypothesis,
           e.goal_event_name,
           e.surface,
           e.status,
           e.traffic_percentage,
           (select count(*) from public.experiment_variants as v
             where v.experiment_id = e.id)::int,
           (select coalesce(sum(v.assignment_count), 0) from public.experiment_variants as v
             where v.experiment_id = e.id)::int,
           (select coalesce(sum(v.conversion_count), 0) from public.experiment_variants as v
             where v.experiment_id = e.id)::int,
           e.started_at,
           e.conclusion
      from public.experiments as e
     where e.deleted_at is null
     order by e.status, e.created_at desc;
end;
$$;

comment on function public.experiment_list() is
  'Lists the tests on the public site with how much traffic each has seen.';

create or replace function public.experiment_variant_list(p_experiment_id uuid)
returns table (
  variant_id uuid,
  key text,
  name text,
  is_control boolean,
  weight smallint,
  assignment_count integer,
  conversion_count integer,
  conversion_rate numeric
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not (public.is_service_role() or public.is_super_admin()) then
    raise exception 'Only the platform team may read the tests' using errcode = '42501';
  end if;

  return query
    select v.id,
           v.key,
           v.name,
           v.is_control,
           v.weight,
           v.assignment_count,
           v.conversion_count,
           case
             when v.assignment_count > 0
               then round(v.conversion_count * 100.0 / v.assignment_count, 2)
             else 0
           end
      from public.experiment_variants as v
     where v.experiment_id = p_experiment_id
     order by v.is_control desc, v.key;
end;
$$;

comment on function public.experiment_variant_list(uuid) is
  'Lists the sides of one test with how each is actually performing.';

-- -----------------------------------------------------------------------------
-- Who may call what
-- -----------------------------------------------------------------------------

revoke execute on function public.save_experiment(
  text, text, text, text, text, integer, uuid
) from public, authenticated;
revoke execute on function public.save_experiment_variant(
  uuid, text, text, integer, boolean, jsonb, uuid
) from public, authenticated;
revoke execute on function public.experiment_list() from public, authenticated;
revoke execute on function public.experiment_variant_list(uuid)
  from public, authenticated;

grant execute on function public.save_experiment(
  text, text, text, text, text, integer, uuid
) to authenticated, service_role;
grant execute on function public.save_experiment_variant(
  uuid, text, text, integer, boolean, jsonb, uuid
) to authenticated, service_role;
grant execute on function public.experiment_list() to authenticated, service_role;
grant execute on function public.experiment_variant_list(uuid)
  to authenticated, service_role;
