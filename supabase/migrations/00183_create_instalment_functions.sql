-- supabase/migrations/00183_create_instalment_functions.sql
-- Building a schedule, taking the payments, and chasing the ones that slip.

-- Creates a plan against an issued invoice and writes its whole schedule.
create or replace function public.create_instalment_plan(
  p_invoice_id uuid,
  p_offer_id uuid,
  p_first_due_date date default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_invoice public.invoices%rowtype;
  v_offer public.instalment_offers%rowtype;
  v_plan_id uuid;
  v_reference text;
  v_next integer;
  v_down numeric;
  v_financed numeric;
  v_interest numeric;
  v_partner_fee numeric;
  v_per_instalment numeric;
  v_remainder numeric;
  v_due date;
  v_first date;
  v_last date;
  v_index smallint;
  v_amount numeric;
begin
  select * into v_invoice
    from public.invoices
   where id = p_invoice_id and deleted_at is null
     for update;

  if not found then
    raise exception 'That invoice does not exist' using errcode = 'P0002';
  end if;

  if not coalesce(
    public.is_service_role() or public.can_write_company_data(v_invoice.company_id),
    false
  ) then
    raise exception 'That account is not yours to write to' using errcode = '42501';
  end if;

  if v_invoice.status not in ('sent', 'viewed', 'partially_paid', 'overdue') then
    raise exception 'An instalment plan is agreed on an invoice that has been sent'
      using errcode = '22023';
  end if;

  select * into v_offer
    from public.instalment_offers
   where id = p_offer_id
     and is_active
     and deleted_at is null
     and (company_id = v_invoice.company_id or company_id is null);

  if not found then
    raise exception 'That instalment offer is not available' using errcode = 'P0002';
  end if;

  if v_invoice.balance_due < v_offer.minimum_invoice_amount
     or (v_offer.maximum_invoice_amount is not null
         and v_invoice.balance_due > v_offer.maximum_invoice_amount) then
    raise exception 'This invoice is outside what that plan covers'
      using errcode = '22023';
  end if;

  v_down := round(v_invoice.balance_due * v_offer.down_payment_percentage / 100, 2);
  v_financed := v_invoice.balance_due - v_down;
  v_interest := round(v_financed * v_offer.interest_rate_percentage / 100, 2);
  v_partner_fee := round(
    v_invoice.balance_due * v_offer.partner_fee_percentage / 100, 2
  );

  v_first := coalesce(
    p_first_due_date,
    case
      when v_offer.interval_unit = 'week'
        then current_date + (7 * v_offer.interval_count)
      else (current_date + make_interval(months => v_offer.interval_count))::date
    end
  );

  select coalesce(
           max(nullif(regexp_replace(plan_reference, '^IP-', ''), '')::integer), 0
         ) + 1
    into v_next
    from public.instalment_plans
   where company_id = v_invoice.company_id
     and plan_reference ~ '^IP-[0-9]+$';

  v_reference := 'IP-' || lpad(v_next::text, 4, '0');

  -- Even parts, with the rounding difference carried by the first payment.
  v_per_instalment := trunc((v_financed + v_interest) / v_offer.instalment_count, 2);
  v_remainder := (v_financed + v_interest)
                 - (v_per_instalment * v_offer.instalment_count);

  v_last := case
    when v_offer.interval_unit = 'week'
      then v_first + (7 * v_offer.interval_count * (v_offer.instalment_count - 1))
    else (v_first + make_interval(
            months => v_offer.interval_count * (v_offer.instalment_count - 1)
          ))::date
  end;

  insert into public.instalment_plans (
    company_id, invoice_id, client_id, offer_id, plan_reference, provider,
    total_amount, down_payment_amount, financed_amount, interest_amount,
    partner_fee_amount, net_settlement_amount, currency, instalment_count,
    outstanding_amount, status, first_due_date, final_due_date, created_by
  )
  values (
    v_invoice.company_id, p_invoice_id, v_invoice.client_id, p_offer_id,
    v_reference, v_offer.provider, v_invoice.balance_due, v_down, v_financed,
    v_interest, v_partner_fee,
    case
      when v_offer.provider = 'self_financed' then null
      else v_invoice.balance_due - v_partner_fee
    end,
    v_invoice.currency, v_offer.instalment_count,
    v_financed + v_interest,
    case when v_offer.requires_approval then 'pending' else 'active' end,
    v_first, v_last, public.current_user_id()
  )
  returning id into v_plan_id;

  v_index := 1;
  v_due := v_first;

  while v_index <= v_offer.instalment_count loop
    v_amount := v_per_instalment + case when v_index = 1 then v_remainder else 0 end;

    insert into public.instalment_schedule_items (
      company_id, plan_id, instalment_number, due_date, amount,
      principal_amount, interest_amount
    )
    values (
      v_invoice.company_id, v_plan_id, v_index, v_due, v_amount,
      round(v_amount * v_financed / nullif(v_financed + v_interest, 0), 2),
      round(v_amount * v_interest / nullif(v_financed + v_interest, 0), 2)
    );

    v_index := (v_index + 1)::smallint;
    v_due := case
      when v_offer.interval_unit = 'week'
        then v_due + (7 * v_offer.interval_count)
      else (v_due + make_interval(months => v_offer.interval_count))::date
    end;
  end loop;

  return v_plan_id;
end;
$$;

comment on function public.create_instalment_plan(uuid, uuid, date) is
  'Agrees an instalment plan on an invoice and writes the whole schedule.';

-- Approves or declines a plan that needed a decision first.
create or replace function public.decide_instalment_plan(
  p_plan_id uuid,
  p_approved boolean,
  p_reason text default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_plan public.instalment_plans%rowtype;
begin
  select * into v_plan
    from public.instalment_plans
   where id = p_plan_id
     for update;

  if not found or v_plan.status <> 'pending' then
    return false;
  end if;

  if not coalesce(
    public.is_service_role() or public.is_company_owner(v_plan.company_id),
    false
  ) then
    raise exception 'Only the account owner can decide an instalment plan'
      using errcode = '42501';
  end if;

  if coalesce(p_approved, false) then
    update public.instalment_plans
       set status = 'active',
           approval_decision = 'approved',
           approved_at = now(),
           updated_at = now()
     where id = p_plan_id;
  else
    if p_reason is null or length(btrim(p_reason)) < 3 then
      raise exception 'A declined plan has to say why' using errcode = '22023';
    end if;

    update public.instalment_plans
       set status = 'declined',
           approval_decision = 'declined',
           declined_reason = p_reason,
           updated_at = now()
     where id = p_plan_id;

    update public.instalment_schedule_items
       set status = 'cancelled',
           updated_at = now()
     where plan_id = p_plan_id
       and status in ('scheduled', 'due');
  end if;

  return true;
end;
$$;

comment on function public.decide_instalment_plan(uuid, boolean, text) is
  'Approves or declines an instalment plan that was waiting for a decision.';

-- Records money against one instalment and moves the plan along.
create or replace function public.record_instalment_payment(
  p_schedule_item_id uuid,
  p_amount numeric,
  p_payment_id uuid default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_item public.instalment_schedule_items%rowtype;
  v_plan public.instalment_plans%rowtype;
  v_paid numeric;
  v_remaining numeric;
begin
  select * into v_item
    from public.instalment_schedule_items
   where id = p_schedule_item_id
     for update;

  if not found then
    raise exception 'That instalment does not exist' using errcode = 'P0002';
  end if;

  if not coalesce(
    public.is_service_role() or public.can_write_company_data(v_item.company_id),
    false
  ) then
    raise exception 'That account is not yours to write to' using errcode = '42501';
  end if;

  if v_item.status in ('paid', 'cancelled', 'written_off') then
    raise exception 'That instalment has already been settled'
      using errcode = '22023';
  end if;

  if coalesce(p_amount, 0) <= 0 then
    raise exception 'A payment has to be more than nothing' using errcode = '22023';
  end if;

  v_paid := v_item.paid_amount + p_amount;

  update public.instalment_schedule_items
     set paid_amount = v_paid,
         payment_id = coalesce(p_payment_id, payment_id),
         status = case
           when v_paid + 0.0001 >= v_item.amount then 'paid'
           else 'partially_paid'
         end,
         paid_at = case
           when v_paid + 0.0001 >= v_item.amount then now()
           else paid_at
         end,
         updated_at = now()
   where id = p_schedule_item_id;

  select * into v_plan
    from public.instalment_plans
   where id = v_item.plan_id
     for update;

  select greatest(sum(i.amount) - sum(i.paid_amount), 0)
    into v_remaining
    from public.instalment_schedule_items as i
   where i.plan_id = v_item.plan_id
     and i.status <> 'cancelled';

  update public.instalment_plans
     set paid_amount = (
           select coalesce(sum(paid_amount), 0)
             from public.instalment_schedule_items
            where plan_id = v_item.plan_id
         ),
         paid_count = (
           select count(*)
             from public.instalment_schedule_items
            where plan_id = v_item.plan_id and status = 'paid'
         )::smallint,
         outstanding_amount = v_remaining,
         status = case
           when v_remaining <= 0.0001 then 'completed'
           when v_plan.status = 'pending' then 'active'
           else v_plan.status
         end,
         completed_at = case when v_remaining <= 0.0001 then now() else completed_at end,
         updated_at = now()
   where id = v_item.plan_id;

  return true;
end;
$$;

comment on function public.record_instalment_payment(uuid, numeric, uuid) is
  'Applies money to one instalment and rolls the totals up to the plan.';

-- Marks what is late, adds the fee once the grace period has passed.
create or replace function public.mark_overdue_instalments()
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  if not coalesce(public.is_service_role() or public.is_super_admin(), false) then
    raise exception 'Only the platform ages instalments' using errcode = '42501';
  end if;

  with aged as (
    update public.instalment_schedule_items as i
       set status = 'overdue',
           late_fee_amount = case
             when i.late_fee_amount > 0 then i.late_fee_amount
             else coalesce(o.late_fee_amount, 0)
           end,
           updated_at = now()
      from public.instalment_plans as p
      left join public.instalment_offers as o on o.id = p.offer_id
     where i.plan_id = p.id
       and p.status = 'active'
       and i.status in ('scheduled', 'due', 'partially_paid')
       and i.due_date + coalesce(o.grace_period_days, 0) < current_date
    returning 1
  )
  select count(*)::int into v_count from aged;

  -- A plan with three missed payments has stopped being a plan.
  update public.instalment_plans as p
     set status = 'defaulted',
         defaulted_at = now(),
         updated_at = now()
   where p.status = 'active'
     and (
       select count(*)
         from public.instalment_schedule_items as i
        where i.plan_id = p.id and i.status = 'overdue'
     ) >= 3;

  return v_count;
end;
$$;

comment on function public.mark_overdue_instalments() is
  'Ages the instalments that are late and defaults the plans that stopped paying.';

-- Instalments falling due soon, which is what the reminder worker reads.
create or replace function public.due_instalments(
  p_within_days integer default 7,
  p_limit integer default 200
)
returns table (
  schedule_item_id uuid,
  plan_id uuid,
  company_id uuid,
  client_id uuid,
  invoice_id uuid,
  due_date date,
  amount numeric,
  currency char(3)
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not coalesce(public.is_service_role() or public.is_super_admin(), false) then
    raise exception 'That queue belongs to the platform' using errcode = '42501';
  end if;

  return query
  select i.id,
         p.id,
         p.company_id,
         p.client_id,
         p.invoice_id,
         i.due_date,
         i.amount - i.paid_amount,
         p.currency
    from public.instalment_schedule_items as i
    join public.instalment_plans as p on p.id = i.plan_id
   where p.status = 'active'
     and i.status in ('scheduled', 'due', 'partially_paid', 'overdue')
     and i.due_date <= current_date + greatest(coalesce(p_within_days, 7), 0)
   order by i.due_date
   limit greatest(coalesce(p_limit, 200), 1);
end;
$$;

comment on function public.due_instalments(integer, integer) is
  'Lists the instalments due soon, for reminders and automatic collection.';

-- Ends a plan early, leaving the invoice to be settled the usual way.
create or replace function public.cancel_instalment_plan(
  p_plan_id uuid,
  p_reason text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_plan public.instalment_plans%rowtype;
begin
  select * into v_plan
    from public.instalment_plans
   where id = p_plan_id
     for update;

  if not found or v_plan.status in ('completed', 'cancelled') then
    return false;
  end if;

  if not coalesce(
    public.is_service_role() or public.is_company_owner(v_plan.company_id),
    false
  ) then
    raise exception 'Only the account owner can cancel an instalment plan'
      using errcode = '42501';
  end if;

  if p_reason is null or length(btrim(p_reason)) < 3 then
    raise exception 'A cancelled plan has to say why' using errcode = '22023';
  end if;

  update public.instalment_plans
     set status = 'cancelled',
         cancelled_at = now(),
         cancellation_reason = p_reason,
         updated_at = now()
   where id = p_plan_id;

  update public.instalment_schedule_items
     set status = 'cancelled',
         updated_at = now()
   where plan_id = p_plan_id
     and status in ('scheduled', 'due', 'overdue', 'partially_paid');

  return true;
end;
$$;

comment on function public.cancel_instalment_plan(uuid, text) is
  'Ends an instalment plan and cancels whatever was still scheduled.';

-- What a client still owes under their plan, in one row.
create or replace function public.instalment_plan_status(p_plan_id uuid)
returns table (
  plan_reference text,
  status text,
  paid_count smallint,
  instalment_count smallint,
  paid_amount numeric,
  outstanding_amount numeric,
  next_due_date date,
  overdue_count integer
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_plan public.instalment_plans%rowtype;
begin
  select * into v_plan from public.instalment_plans where id = p_plan_id;

  if not found then
    return;
  end if;

  if not coalesce(
    public.is_service_role() or public.has_company_access(v_plan.company_id),
    false
  ) then
    raise exception 'That plan is not yours to read' using errcode = '42501';
  end if;

  return query
  select v_plan.plan_reference,
         v_plan.status,
         v_plan.paid_count,
         v_plan.instalment_count,
         v_plan.paid_amount,
         v_plan.outstanding_amount,
         (select min(i.due_date)
            from public.instalment_schedule_items as i
           where i.plan_id = p_plan_id
             and i.status in ('scheduled', 'due', 'partially_paid', 'overdue')),
         (select count(*)
            from public.instalment_schedule_items as i
           where i.plan_id = p_plan_id and i.status = 'overdue')::integer;
end;
$$;

comment on function public.instalment_plan_status(uuid) is
  'Summarises an instalment plan: what has been paid and what is late.';
