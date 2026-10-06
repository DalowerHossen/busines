-- supabase/migrations/00194_create_subscription_self_service.sql
-- What a business can do with its own plan without writing to support.
--
-- Two gaps are closed here. A tenant that asked to stop can change its mind
-- while the paid period is still running, and the billing screen needs every
-- metered allowance in one answer rather than one round trip per meter.

-- Puts a subscription back into service.
--
-- A plan scheduled to stop at the end of the period simply loses that
-- instruction. A plan already paused for non payment is woken up, which is
-- what happens the moment the outstanding platform invoice is settled. A plan
-- that has truly ended is not revived here: that is a new subscription.
create or replace function public.resume_subscription(
  p_subscription_id uuid,
  p_reason text default null
)
returns public.subscription_status
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_subscription public.subscriptions%rowtype;
  v_status public.subscription_status;
begin
  select * into v_subscription
    from public.subscriptions
   where id = p_subscription_id
     and deleted_at is null
     for update;

  if not found then
    raise exception 'Subscription % was not found', p_subscription_id using errcode = 'P0002';
  end if;

  if not (public.is_super_admin() or public.is_company_owner(v_subscription.company_id)) then
    raise exception 'Only the account owner can restart the plan' using errcode = '42501';
  end if;

  if v_subscription.status in ('cancelled', 'expired') then
    raise exception 'This plan has already ended, so choose a plan to start again'
      using errcode = '22023';
  end if;

  if not v_subscription.cancel_at_period_end and v_subscription.status <> 'paused' then
    raise exception 'This plan is already running' using errcode = '22023';
  end if;

  v_status := case
                when v_subscription.status = 'paused' then 'active'::public.subscription_status
                else v_subscription.status
              end;

  update public.subscriptions
     set status = v_status,
         cancel_at_period_end = false,
         cancelled_at = null,
         cancellation_reason = null,
         paused_at = null,
         resumes_at = null,
         next_billing_date = greatest(current_period_end, current_date),
         updated_at = now()
   where id = p_subscription_id;

  insert into public.subscription_changes (
    subscription_id, company_id, change_type, from_plan_id, to_plan_id,
    from_amount, to_amount, reason, changed_by
  )
  values (
    p_subscription_id, v_subscription.company_id,
    case when v_subscription.status = 'paused' then 'resumed' else 'reactivated' end,
    v_subscription.plan_id, v_subscription.plan_id,
    v_subscription.amount, v_subscription.amount, p_reason, public.current_user_id()
  );

  return v_status;
end;
$$;

comment on function public.resume_subscription(uuid, text) is
  'Withdraws a scheduled cancellation, or wakes a plan paused for non payment.';

-- Returns every metered allowance of a company in one answer.
--
-- Both sides are reported: the meters the plan sets a ceiling on, and the
-- meters the tenant has actually used. An allowance of null means the plan
-- places no limit on that item, and the billing screen says so in words
-- rather than drawing an empty bar.
create or replace function public.company_usage_snapshot(p_company_id uuid)
returns table (
  metric_key text,
  period_key text,
  used bigint,
  allowance bigint,
  remaining bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_limits jsonb;
begin
  if not (public.is_super_admin() or public.has_company_access(p_company_id)) then
    raise exception 'You cannot read the usage of that business' using errcode = '42501';
  end if;

  v_limits := coalesce(public.company_entitlements(p_company_id) -> 'limits', '{}'::jsonb);

  return query
  with metrics as (
    select jsonb_object_keys(v_limits) as key
    union
    select c.metric_key from public.usage_counters as c where c.company_id = p_company_id
  ),
  measured as (
    select m.key as metric_key,
           public.usage_period_key(m.key) as period_key,
           coalesce(
             (select c.used_quantity
                from public.usage_counters as c
               where c.company_id = p_company_id
                 and c.metric_key = m.key
                 and c.period_key = public.usage_period_key(m.key)),
             0
           )::bigint as used,
           nullif(v_limits ->> m.key, 'null')::bigint as allowance
      from metrics as m
  )
  select measured.metric_key,
         measured.period_key,
         measured.used,
         measured.allowance,
         case
           when measured.allowance is null then null::bigint
           else greatest(measured.allowance - measured.used, 0)
         end as remaining
    from measured
   order by measured.metric_key;
end;
$$;

comment on function public.company_usage_snapshot(uuid) is
  'Lists every metered allowance of a company with what has been used of it.';

grant execute on function public.resume_subscription(uuid, text) to authenticated;
grant execute on function public.company_usage_snapshot(uuid) to authenticated;
