-- supabase/migrations/00072_create_subscription_billing.sql
-- Platform side billing: numbering, renewal invoices, payment and dunning.
--
-- These invoices are what the platform charges a tenant for its plan. They are
-- numbered in their own continuous yearly series, kept well away from the
-- numbering a tenant uses for its own customers.

create table public.platform_invoice_counters (
  period_key text primary key,
  next_value bigint not null default 1,
  last_issued_number text,
  last_issued_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint platform_invoice_counters_next_value_check check (next_value > 0)
);

comment on table public.platform_invoice_counters is
  'Yearly counters for the invoices the platform issues to its own tenants.';

create or replace function public.next_platform_invoice_number(
  p_reference date default current_date
)
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_period_key text := to_char(p_reference, 'YYYY');
  v_counter public.platform_invoice_counters%rowtype;
  v_number text;
begin
  perform pg_advisory_xact_lock(hashtextextended('platform-invoice:' || v_period_key, 0));

  select * into v_counter
    from public.platform_invoice_counters
   where period_key = v_period_key
     for update;

  if not found then
    insert into public.platform_invoice_counters (period_key)
    values (v_period_key)
    returning * into v_counter;
  end if;

  v_number := 'KD-' || v_period_key || '-' || lpad(v_counter.next_value::text, 6, '0');

  update public.platform_invoice_counters
     set next_value = v_counter.next_value + 1,
         last_issued_number = v_number,
         last_issued_at = now(),
         updated_at = now()
   where period_key = v_period_key;

  return v_number;
end;
$$;

comment on function public.next_platform_invoice_number(date) is
  'Issues the next number in the yearly platform invoice series.';

-- -----------------------------------------------------------------------------
-- Renewal invoices
-- -----------------------------------------------------------------------------

create or replace function public.create_subscription_invoice(
  p_subscription_id uuid,
  p_issue_date date default current_date
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_subscription public.subscriptions%rowtype;
  v_plan public.subscription_plans%rowtype;
  v_discount numeric := 0;
  v_coupon public.coupons%rowtype;
  v_total numeric;
  v_invoice_id uuid;
begin
  select * into v_subscription
    from public.subscriptions
   where id = p_subscription_id
     and deleted_at is null
     for update;

  if not found then
    raise exception 'Subscription % was not found', p_subscription_id using errcode = 'P0002';
  end if;

  select * into v_plan from public.subscription_plans where id = v_subscription.plan_id;

  if v_subscription.amount <= 0 then
    return null;
  end if;

  if exists (
    select 1
      from public.subscription_invoices
     where subscription_id = p_subscription_id
       and period_start = v_subscription.current_period_start
       and deleted_at is null
  ) then
    return null;
  end if;

  if v_subscription.coupon_id is not null then
    select * into v_coupon from public.coupons where id = v_subscription.coupon_id;

    if found then
      v_discount := case
        when v_coupon.coupon_type = 'percentage'
          then round(v_subscription.amount * v_coupon.value / 100, 4)
        when v_coupon.coupon_type = 'fixed_amount'
          then least(v_coupon.value, v_subscription.amount)
        else 0
      end;
    end if;
  end if;

  v_total := greatest(v_subscription.amount - v_discount, 0);

  insert into public.subscription_invoices (
    company_id, subscription_id, invoice_number, status, description,
    period_start, period_end, issue_date, due_date, currency,
    subtotal_amount, discount_amount, total_amount, line_items
  )
  values (
    v_subscription.company_id,
    p_subscription_id,
    public.next_platform_invoice_number(p_issue_date),
    'sent',
    coalesce(v_plan.name, 'Subscription') || ' plan',
    v_subscription.current_period_start,
    v_subscription.current_period_end,
    p_issue_date,
    p_issue_date + 7,
    v_subscription.currency,
    v_subscription.amount,
    v_discount,
    v_total,
    jsonb_build_array(
      jsonb_build_object(
        'description', coalesce(v_plan.name, 'Subscription') || ' plan',
        'interval', v_subscription.billing_interval,
        'period_start', v_subscription.current_period_start,
        'period_end', v_subscription.current_period_end,
        'amount', v_subscription.amount
      )
    )
  )
  returning id into v_invoice_id;

  return v_invoice_id;
end;
$$;

comment on function public.create_subscription_invoice(uuid, date) is
  'Raises the platform invoice for the current period of a subscription.';

-- Records a payment against a platform invoice and settles the subscription.
create or replace function public.settle_subscription_invoice(
  p_invoice_id uuid,
  p_amount numeric,
  p_payment_id uuid default null
)
returns public.invoice_status
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_invoice public.subscription_invoices%rowtype;
  v_paid numeric;
  v_status public.invoice_status;
  v_days integer;
begin
  select * into v_invoice
    from public.subscription_invoices
   where id = p_invoice_id and deleted_at is null for update;

  if not found then
    raise exception 'Platform invoice % was not found', p_invoice_id using errcode = 'P0002';
  end if;

  if p_amount <= 0 then
    raise exception 'A payment must be greater than zero' using errcode = '22023';
  end if;

  v_paid := v_invoice.paid_amount + p_amount;

  if v_paid > v_invoice.total_amount then
    raise exception 'The payment is larger than the amount outstanding'
      using errcode = '22023';
  end if;

  v_status := case
    when v_paid >= v_invoice.total_amount then 'paid'::public.invoice_status
    else 'partially_paid'::public.invoice_status
  end;

  update public.subscription_invoices
     set paid_amount = v_paid,
         status = v_status,
         paid_at = case when v_status = 'paid' then now() else paid_at end,
         payment_id = coalesce(p_payment_id, payment_id),
         updated_at = now()
   where id = p_invoice_id;

  if v_status = 'paid' and v_invoice.subscription_id is not null then
    select case billing_interval
             when 'annual' then 365
             when 'lifetime' then 36500
             else 30
           end
      into v_days
      from public.subscriptions
     where id = v_invoice.subscription_id;

    update public.subscriptions
       set status = case
                      when cancel_at_period_end then status
                      else 'active'::public.subscription_status
                    end,
           current_period_start = greatest(current_period_end, current_date),
           current_period_end = greatest(current_period_end, current_date) + v_days,
           next_billing_date = case
                                 when cancel_at_period_end then null
                                 else greatest(current_period_end, current_date) + v_days
                               end,
           past_due_since = null,
           dunning_attempt_count = 0,
           grace_period_ends_on = null,
           updated_at = now()
     where id = v_invoice.subscription_id;

    insert into public.subscription_changes (
      subscription_id, company_id, change_type, reason
    )
    values (
      v_invoice.subscription_id, v_invoice.company_id, 'renewed',
      'The period was paid and the subscription rolled forward'
    );

    perform public.record_affiliate_commission(p_invoice_id);
  end if;

  return v_status;
end;
$$;

comment on function public.settle_subscription_invoice(uuid, numeric, uuid) is
  'Applies a payment to a platform invoice and rolls the subscription forward.';

-- -----------------------------------------------------------------------------
-- Renewal and dunning runs
-- -----------------------------------------------------------------------------

-- Raises invoices for every subscription whose period is about to end.
create or replace function public.run_subscription_renewals(
  p_lead_days integer default 0
)
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_row record;
  v_invoice_id uuid;
  v_count integer := 0;
begin
  for v_row in
    select id
      from public.subscriptions
     where deleted_at is null
       and status in ('active', 'past_due')
       and not cancel_at_period_end
       and amount > 0
       and next_billing_date is not null
       and next_billing_date <= current_date + p_lead_days
  loop
    v_invoice_id := public.create_subscription_invoice(v_row.id);

    if v_invoice_id is not null then
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

comment on function public.run_subscription_renewals(integer) is
  'Raises the next platform invoice for every subscription that is due.';

-- Advances the dunning ladder for subscriptions with an unpaid invoice.
create or replace function public.run_subscription_dunning(
  p_grace_days integer default 14
)
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
    select s.id, s.company_id, s.plan_id, s.past_due_since, s.dunning_attempt_count
      from public.subscriptions as s
     where s.deleted_at is null
       and s.status in ('active', 'past_due')
       and exists (
         select 1
           from public.subscription_invoices as i
          where i.subscription_id = s.id
            and i.deleted_at is null
            and i.status in ('sent', 'partially_paid', 'overdue')
            and i.due_date < current_date
       )
  loop
    if v_row.past_due_since is not null
       and v_row.past_due_since + p_grace_days < current_date then
      update public.subscriptions
         set status = 'paused',
             paused_at = now(),
             dunning_attempt_count = v_row.dunning_attempt_count + 1,
             last_dunning_email_at = now(),
             updated_at = now()
       where id = v_row.id;

      insert into public.subscription_changes (
        subscription_id, company_id, change_type, from_plan_id, reason
      )
      values (
        v_row.id, v_row.company_id, 'paused', v_row.plan_id,
        'Access was paused after the payment grace period ran out'
      );
    else
      update public.subscriptions
         set status = 'past_due',
             past_due_since = coalesce(past_due_since, current_date),
             grace_period_ends_on =
               coalesce(grace_period_ends_on, current_date + p_grace_days),
             dunning_attempt_count = least(v_row.dunning_attempt_count + 1, 20),
             last_dunning_email_at = now(),
             updated_at = now()
       where id = v_row.id;
    end if;

    update public.subscription_invoices
       set status = 'overdue',
           updated_at = now()
     where subscription_id = v_row.id
       and deleted_at is null
       and status in ('sent', 'partially_paid')
       and due_date < current_date;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

comment on function public.run_subscription_dunning(integer) is
  'Marks overdue platform invoices and moves accounts along the dunning ladder.';
