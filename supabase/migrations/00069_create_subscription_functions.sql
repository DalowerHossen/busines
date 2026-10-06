-- supabase/migrations/00069_create_subscription_functions.sql
-- Starting, changing, renewing and cancelling a subscription.
--
-- Every routine writes to public.subscription_changes, so the history of an
-- account can always be reconstructed, and none of them ever leaves a company
-- without a subscription.

-- Puts a new company on the signup plan, with a trial when the plan offers one.
create or replace function public.start_default_subscription(p_company_id uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_plan public.subscription_plans%rowtype;
  v_price public.plan_prices%rowtype;
  v_subscription_id uuid;
  v_company public.companies%rowtype;
begin
  if exists (
    select 1
      from public.subscriptions
     where company_id = p_company_id
       and deleted_at is null
       and status not in ('cancelled', 'expired')
  ) then
    return (
      select id
        from public.subscriptions
       where company_id = p_company_id
         and deleted_at is null
         and status not in ('cancelled', 'expired')
       limit 1
    );
  end if;

  select * into v_company from public.companies where id = p_company_id;

  select * into v_plan
    from public.subscription_plans
   where is_default_on_signup
     and deleted_at is null
   limit 1;

  if not found then
    return null;
  end if;

  select * into v_price
    from public.plan_prices
   where plan_id = v_plan.id
     and billing_interval = 'monthly'
     and currency = coalesce(v_company.base_currency, 'USD')
     and is_active
     and deleted_at is null
   limit 1;

  insert into public.subscriptions (
    company_id, plan_id, plan_price_id, status, billing_interval, currency, amount,
    current_period_start, current_period_end, next_billing_date,
    trial_start_date, trial_end_date
  )
  values (
    p_company_id,
    v_plan.id,
    v_price.id,
    case when v_plan.trial_days > 0
         then 'trialing'::public.subscription_status
         else 'active'::public.subscription_status
    end,
    'monthly'::public.billing_interval,
    coalesce(v_price.currency, v_company.base_currency, 'USD'),
    coalesce(v_price.amount, 0),
    current_date,
    current_date + 30,
    case when v_plan.is_free then null else current_date + 30 end,
    case when v_plan.trial_days > 0 then current_date else null end,
    case when v_plan.trial_days > 0 then current_date + v_plan.trial_days else null end
  )
  returning id into v_subscription_id;

  insert into public.subscription_changes (
    subscription_id, company_id, change_type, to_plan_id, to_amount, reason
  )
  values (
    v_subscription_id, p_company_id, 'created', v_plan.id, coalesce(v_price.amount, 0),
    'Subscription opened on the signup plan'
  );

  return v_subscription_id;
end;
$$;

comment on function public.start_default_subscription(uuid) is
  'Places a new company on the signup plan, starting a trial where offered.';

-- Moves a company to another plan, charging or crediting the unused days.
create or replace function public.change_subscription_plan(
  p_subscription_id uuid,
  p_plan_id uuid,
  p_billing_interval public.billing_interval default null,
  p_reason text default null
)
returns numeric
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_subscription public.subscriptions%rowtype;
  v_new_plan public.subscription_plans%rowtype;
  v_new_price public.plan_prices%rowtype;
  v_interval public.billing_interval;
  v_days_total integer;
  v_days_left integer;
  v_unused_credit numeric := 0;
  v_new_charge numeric := 0;
  v_proration numeric := 0;
  v_change_type text;
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
    raise exception 'Only the account owner can change the plan' using errcode = '42501';
  end if;

  select * into v_new_plan
    from public.subscription_plans
   where id = p_plan_id
     and deleted_at is null
     and not is_archived;

  if not found then
    raise exception 'Plan % is not available', p_plan_id using errcode = 'P0002';
  end if;

  v_interval := coalesce(p_billing_interval, v_subscription.billing_interval);

  select * into v_new_price
    from public.plan_prices
   where plan_id = p_plan_id
     and billing_interval = v_interval
     and currency = v_subscription.currency
     and is_active
     and deleted_at is null
   limit 1;

  if not found and not v_new_plan.is_free then
    raise exception 'This plan has no price in %', v_subscription.currency
      using errcode = 'P0002';
  end if;

  -- Proration: the unused part of the current period is credited against the
  -- first period of the new plan.
  v_days_total := greatest(
    (v_subscription.current_period_end - v_subscription.current_period_start), 1
  );
  v_days_left := greatest((v_subscription.current_period_end - current_date), 0);

  v_unused_credit := round(v_subscription.amount * v_days_left / v_days_total, 4);
  v_new_charge := round(coalesce(v_new_price.amount, 0) * v_days_left / v_days_total, 4);
  v_proration := v_new_charge - v_unused_credit;

  if coalesce(v_new_price.amount, 0) > v_subscription.amount then
    v_change_type := 'upgrade';
  elsif coalesce(v_new_price.amount, 0) < v_subscription.amount then
    v_change_type := 'downgrade';
  else
    v_change_type := 'interval_change';
  end if;

  insert into public.subscription_changes (
    subscription_id, company_id, change_type, from_plan_id, to_plan_id,
    from_amount, to_amount, proration_amount, reason, changed_by
  )
  values (
    p_subscription_id, v_subscription.company_id, v_change_type,
    v_subscription.plan_id, p_plan_id, v_subscription.amount,
    coalesce(v_new_price.amount, 0), v_proration, p_reason, public.current_user_id()
  );

  update public.subscriptions
     set plan_id = p_plan_id,
         plan_price_id = v_new_price.id,
         billing_interval = v_interval,
         amount = coalesce(v_new_price.amount, 0),
         status = case
                    when v_new_plan.is_free then 'active'::public.subscription_status
                    when status = 'past_due' then 'active'::public.subscription_status
                    else status
                  end,
         past_due_since = null,
         dunning_attempt_count = 0,
         updated_at = now()
   where id = p_subscription_id;

  return v_proration;
end;
$$;

comment on function public.change_subscription_plan(
  uuid, uuid, public.billing_interval, text
) is 'Switches a company to another plan and returns the prorated difference.';

-- Schedules or performs a cancellation.
create or replace function public.cancel_subscription(
  p_subscription_id uuid,
  p_immediately boolean default false,
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
   where id = p_subscription_id and deleted_at is null for update;

  if not found then
    raise exception 'Subscription % was not found', p_subscription_id using errcode = 'P0002';
  end if;

  if not (public.is_super_admin() or public.is_company_owner(v_subscription.company_id)) then
    raise exception 'Only the account owner can cancel the plan' using errcode = '42501';
  end if;

  if p_immediately then
    v_status := 'cancelled';

    update public.subscriptions
       set status = v_status,
           cancel_at_period_end = false,
           cancelled_at = now(),
           cancellation_reason = p_reason,
           ended_at = now(),
           next_billing_date = null,
           updated_at = now()
     where id = p_subscription_id;
  else
    v_status := v_subscription.status;

    update public.subscriptions
       set cancel_at_period_end = true,
           cancellation_reason = p_reason,
           cancelled_at = now(),
           next_billing_date = null,
           updated_at = now()
     where id = p_subscription_id;
  end if;

  insert into public.subscription_changes (
    subscription_id, company_id, change_type, from_plan_id, reason, changed_by
  )
  values (
    p_subscription_id, v_subscription.company_id, 'cancelled', v_subscription.plan_id,
    p_reason, public.current_user_id()
  );

  return v_status;
end;
$$;

comment on function public.cancel_subscription(uuid, boolean, text) is
  'Cancels a subscription at the end of the period, or at once when asked.';

-- Ends trials that have run out, moving them onto their plan or to past due.
create or replace function public.process_expired_trials()
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_row record;
  v_count integer := 0;
begin
  for v_row in
    select s.id, s.company_id, s.plan_id, s.amount, p.is_free
      from public.subscriptions as s
      join public.subscription_plans as p on p.id = s.plan_id
     where s.deleted_at is null
       and s.status = 'trialing'
       and s.trial_end_date is not null
       and s.trial_end_date < current_date
  loop
    update public.subscriptions
       set status = case
                      when v_row.is_free or v_row.amount = 0
                        then 'active'::public.subscription_status
                      else 'past_due'::public.subscription_status
                    end,
           is_trial_used = true,
           past_due_since = case
                              when v_row.is_free or v_row.amount = 0 then null
                              else current_date
                            end,
           updated_at = now()
     where id = v_row.id;

    insert into public.subscription_changes (
      subscription_id, company_id, change_type, from_plan_id, reason
    )
    values (
      v_row.id, v_row.company_id, 'trial_ended', v_row.plan_id,
      'The trial period came to an end'
    );

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

comment on function public.process_expired_trials() is
  'Moves finished trials onto their plan, or into dunning when payment is due.';

-- Closes subscriptions that were scheduled to end and whose period has passed.
create or replace function public.process_scheduled_cancellations()
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_row record;
  v_count integer := 0;
begin
  for v_row in
    select id, company_id, plan_id
      from public.subscriptions
     where deleted_at is null
       and cancel_at_period_end
       and status not in ('cancelled', 'expired')
       and current_period_end < current_date
  loop
    update public.subscriptions
       set status = 'expired',
           ended_at = now(),
           updated_at = now()
     where id = v_row.id;

    insert into public.subscription_changes (
      subscription_id, company_id, change_type, from_plan_id, reason
    )
    values (
      v_row.id, v_row.company_id, 'expired', v_row.plan_id,
      'The cancelled subscription reached the end of its paid period'
    );

    -- The tenant keeps its data and falls back to the signup plan.
    perform public.start_default_subscription(v_row.company_id);

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

comment on function public.process_scheduled_cancellations() is
  'Ends subscriptions whose paid period has run out and returns them to free.';
