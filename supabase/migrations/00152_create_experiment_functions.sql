-- supabase/migrations/00152_create_experiment_functions.sql
-- Assigning visitors to variants and reading the result.

-- The weights of one experiment have to add up to one hundred, otherwise the
-- split is not the split anybody intended.
create or replace function public.experiment_weights_balanced(p_experiment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(sum(weight), 0) = 100
    from public.experiment_variants
   where experiment_id = p_experiment_id;
$$;

comment on function public.experiment_weights_balanced(uuid) is
  'Returns whether the variant weights of an experiment add up to one hundred.';

-- Starts an experiment, once it is actually fit to run.
create or replace function public.start_experiment(p_experiment_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_experiment public.experiments%rowtype;
  v_variant_count integer;
begin
  if not (public.is_service_role() or public.is_super_admin()) then
    raise exception 'Only the platform team can run a site experiment'
      using errcode = '42501';
  end if;

  select * into v_experiment
    from public.experiments
   where id = p_experiment_id and deleted_at is null
     for update;

  if not found then
    raise exception 'That experiment does not exist' using errcode = 'P0002';
  end if;

  if v_experiment.status not in ('draft', 'paused') then
    raise exception 'Only a draft or paused experiment can be started'
      using errcode = '22023';
  end if;

  select count(*) into v_variant_count
    from public.experiment_variants
   where experiment_id = p_experiment_id;

  if v_variant_count < 2 then
    raise exception 'An experiment needs at least two variants'
      using errcode = '22023';
  end if;

  if not public.experiment_weights_balanced(p_experiment_id) then
    raise exception 'The variant weights have to add up to one hundred'
      using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.experiment_variants
     where experiment_id = p_experiment_id and is_control
  ) then
    raise exception 'An experiment needs a control to compare against'
      using errcode = '22023';
  end if;

  update public.experiments
     set status = 'running',
         started_at = coalesce(started_at, now()),
         updated_at = now()
   where id = p_experiment_id;

  return true;
end;
$$;

comment on function public.start_experiment(uuid) is
  'Starts an experiment once it has a control and a balanced split.';

-- Decides which variant this visitor sees, and remembers the answer. The
-- choice is made from a hash of the visitor and the experiment, so it is
-- stable across page loads and across servers.
create or replace function public.assign_experiment_variant(
  p_experiment_key text,
  p_visitor_token text
)
returns table (
  variant_id uuid,
  variant_key text,
  overrides jsonb,
  is_control boolean
)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_experiment public.experiments%rowtype;
  v_existing uuid;
  v_bucket integer;
  v_cursor integer := 0;
  v_variant public.experiment_variants%rowtype;
  v_chosen public.experiment_variants%rowtype;
begin
  select * into v_experiment
    from public.experiments
   where key = p_experiment_key
     and status = 'running'
     and deleted_at is null;

  if not found then
    return;
  end if;

  -- Somebody who has already been placed stays where they were placed.
  select a.variant_id into v_existing
    from public.experiment_assignments as a
   where a.experiment_id = v_experiment.id
     and a.visitor_token = p_visitor_token;

  if v_existing is not null then
    return query
    select v.id, v.key, v.overrides, v.is_control
      from public.experiment_variants as v
     where v.id = v_existing;
    return;
  end if;

  v_bucket := ('x' || substr(
    encode(extensions.digest(p_experiment_key || p_visitor_token, 'sha256'), 'hex'),
    1, 4
  ))::bit(16)::integer % 100;

  -- Visitors outside the traffic share always see the control, and are not
  -- recorded as taking part at all.
  if v_bucket >= v_experiment.traffic_percentage then
    return query
    select v.id, v.key, v.overrides, v.is_control
      from public.experiment_variants as v
     where v.experiment_id = v_experiment.id and v.is_control;
    return;
  end if;

  for v_variant in
    select * from public.experiment_variants
     where experiment_id = v_experiment.id
     order by is_control desc, key
  loop
    v_cursor := v_cursor + v_variant.weight;

    if v_bucket < v_cursor then
      v_chosen := v_variant;
      exit;
    end if;
  end loop;

  if v_chosen.id is null then
    select * into v_chosen
      from public.experiment_variants
     where experiment_id = v_experiment.id and is_control;
  end if;

  insert into public.experiment_assignments (
    experiment_id, variant_id, visitor_token, user_id
  )
  values (v_experiment.id, v_chosen.id, p_visitor_token, public.current_user_id())
  on conflict (experiment_id, visitor_token) do nothing;

  update public.experiment_variants
     set assignment_count = assignment_count + 1,
         updated_at = now()
   where id = v_chosen.id;

  return query
  select v_chosen.id, v_chosen.key, v_chosen.overrides, v_chosen.is_control;
end;
$$;

comment on function public.assign_experiment_variant(text, text) is
  'Places a visitor in a variant and keeps them there for the whole experiment.';

-- Records that this visitor did the thing the experiment was about.
create or replace function public.record_experiment_conversion(
  p_experiment_key text,
  p_visitor_token text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_assignment public.experiment_assignments%rowtype;
begin
  select a.* into v_assignment
    from public.experiment_assignments as a
    join public.experiments as e on e.id = a.experiment_id
   where e.key = p_experiment_key
     and a.visitor_token = p_visitor_token
     for update of a;

  if not found or v_assignment.converted_at is not null then
    return false;
  end if;

  update public.experiment_assignments
     set converted_at = now()
   where id = v_assignment.id;

  update public.experiment_variants
     set conversion_count = conversion_count + 1,
         updated_at = now()
   where id = v_assignment.variant_id;

  return true;
end;
$$;

comment on function public.record_experiment_conversion(text, text) is
  'Counts a conversion once for the variant the visitor was shown.';

-- The result, in the only terms that matter: how many saw it and how many
-- went on to do the thing.
create or replace function public.experiment_results(p_experiment_key text)
returns table (
  variant_key text,
  variant_name text,
  is_control boolean,
  assignments integer,
  conversions integer,
  conversion_rate numeric,
  lift_over_control numeric
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with variants as (
    select v.key,
           v.name,
           v.is_control,
           v.assignment_count,
           v.conversion_count,
           case
             when v.assignment_count > 0
             then round(v.conversion_count * 100.0 / v.assignment_count, 2)
             else 0
           end as rate
      from public.experiment_variants as v
      join public.experiments as e on e.id = v.experiment_id
     where e.key = p_experiment_key
  ),
  control as (
    select rate from variants where is_control limit 1
  )
  select v.key,
         v.name,
         v.is_control,
         v.assignment_count,
         v.conversion_count,
         v.rate,
         case
           when (select rate from control) > 0
           then round(
             (v.rate - (select rate from control)) * 100.0
             / (select rate from control),
             1
           )
           else 0
         end
    from variants as v
   order by v.is_control desc, v.rate desc;
$$;

comment on function public.experiment_results(text) is
  'Reports how each variant performed against the control.';

-- Ends an experiment and writes down what was decided.
create or replace function public.conclude_experiment(
  p_experiment_id uuid,
  p_winning_variant_id uuid,
  p_conclusion text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_experiment public.experiments%rowtype;
begin
  if not (public.is_service_role() or public.is_super_admin()) then
    raise exception 'Only the platform team can conclude an experiment'
      using errcode = '42501';
  end if;

  select * into v_experiment
    from public.experiments
   where id = p_experiment_id and deleted_at is null
     for update;

  if not found then
    raise exception 'That experiment does not exist' using errcode = 'P0002';
  end if;

  if v_experiment.status not in ('running', 'paused') then
    raise exception 'Only a running experiment can be concluded'
      using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.experiment_variants
     where id = p_winning_variant_id and experiment_id = p_experiment_id
  ) then
    raise exception 'The winning variant has to belong to this experiment'
      using errcode = '22023';
  end if;

  update public.experiments
     set status = 'concluded',
         ended_at = now(),
         winning_variant_id = p_winning_variant_id,
         conclusion = p_conclusion,
         updated_at = now()
   where id = p_experiment_id;

  return true;
end;
$$;

comment on function public.conclude_experiment(uuid, uuid, text) is
  'Ends an experiment, names the winner and records the reasoning.';
