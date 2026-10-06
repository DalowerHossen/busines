-- supabase/migrations/00208_create_instalment_portal.sql
-- The screens behind paying in parts.
--
-- Building a schedule, taking the payments and chasing what slips were all
-- written when the tables were built. What was missing was the ordinary work
-- around them: deciding what instalment terms the business offers, seeing
-- which plans are running, and reading one plan with its whole schedule.
-- Those routines live here. What a client is allowed to be offered is worked
-- out from the invoice itself, so a plan can never be built on terms the
-- business did not agree to.

-- -----------------------------------------------------------------------------
-- The terms a business offers
-- -----------------------------------------------------------------------------

create or replace function public.company_instalment_offers(p_company_id uuid)
returns table (
  offer_id uuid,
  name text,
  provider text,
  description text,
  instalment_count smallint,
  interval_unit text,
  interval_count smallint,
  down_payment_percentage numeric,
  interest_rate_percentage numeric,
  partner_fee_percentage numeric,
  late_fee_amount numeric,
  grace_period_days smallint,
  minimum_invoice_amount numeric,
  maximum_invoice_amount numeric,
  currency char(3),
  requires_approval boolean,
  is_active boolean,
  is_platform boolean,
  plans_running integer
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not coalesce(
    public.is_service_role() or public.has_company_access(p_company_id),
    false
  ) then
    raise exception 'Those terms belong to another business' using errcode = '42501';
  end if;

  return query
  select o.id,
         o.name,
         o.provider,
         o.description,
         o.instalment_count,
         o.interval_unit,
         o.interval_count,
         o.down_payment_percentage,
         o.interest_rate_percentage,
         o.partner_fee_percentage,
         o.late_fee_amount,
         o.grace_period_days,
         o.minimum_invoice_amount,
         o.maximum_invoice_amount,
         o.currency,
         o.requires_approval,
         o.is_active,
         o.company_id is null,
         (
           select count(*)::int
             from public.instalment_plans as p
            where p.offer_id = o.id
              and p.company_id = p_company_id
              and p.status in ('pending', 'active')
         )
    from public.instalment_offers as o
   where o.deleted_at is null
     and (o.company_id = p_company_id or o.company_id is null)
   order by o.company_id nulls last, o.display_order, o.name;
end;
$$;

comment on function public.company_instalment_offers(uuid) is
  'Lists the instalment terms a business can offer, including platform terms.';

-- Writes one set of terms. Platform terms are read only to a tenant, so this
-- only ever touches rows the business owns.
create or replace function public.save_instalment_offer(
  p_company_id uuid,
  p_name text,
  p_instalment_count smallint,
  p_offer_id uuid default null,
  p_provider text default 'self_financed',
  p_description text default null,
  p_interval_unit text default 'month',
  p_interval_count smallint default 1,
  p_down_payment_percentage numeric default 0,
  p_interest_rate_percentage numeric default 0,
  p_partner_fee_percentage numeric default 0,
  p_late_fee_amount numeric default 0,
  p_grace_period_days smallint default 3,
  p_minimum_invoice_amount numeric default 0,
  p_maximum_invoice_amount numeric default null,
  p_currency char(3) default 'USD',
  p_requires_approval boolean default false
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.instalment_offers%rowtype;
  v_offer_id uuid;
begin
  if not coalesce(
    public.is_service_role() or public.is_company_owner(p_company_id),
    false
  ) then
    raise exception 'Only the account owner can set instalment terms'
      using errcode = '42501';
  end if;

  if p_instalment_count < 2 then
    raise exception 'Paying in parts means at least two payments'
      using errcode = '22023';
  end if;

  if p_offer_id is null then
    insert into public.instalment_offers (
      company_id, name, provider, description, instalment_count, interval_unit,
      interval_count, down_payment_percentage, interest_rate_percentage,
      partner_fee_percentage, late_fee_amount, grace_period_days,
      minimum_invoice_amount, maximum_invoice_amount, currency,
      requires_approval, created_by, updated_by
    )
    values (
      p_company_id, btrim(p_name), p_provider, p_description, p_instalment_count,
      p_interval_unit, p_interval_count, p_down_payment_percentage,
      p_interest_rate_percentage, p_partner_fee_percentage, p_late_fee_amount,
      p_grace_period_days, p_minimum_invoice_amount, p_maximum_invoice_amount,
      p_currency, coalesce(p_requires_approval, false),
      public.current_user_id(), public.current_user_id()
    )
    returning id into v_offer_id;

    return v_offer_id;
  end if;

  select * into v_existing
    from public.instalment_offers
   where id = p_offer_id and deleted_at is null
     for update;

  if not found then
    raise exception 'Those terms were not found' using errcode = 'P0002';
  end if;

  if v_existing.company_id is null then
    raise exception 'The terms the platform ships with cannot be edited. Copy them instead.'
      using errcode = '42501';
  end if;

  if v_existing.company_id <> p_company_id then
    raise exception 'Those terms belong to another business' using errcode = '42501';
  end if;

  update public.instalment_offers
     set name = btrim(p_name),
         provider = p_provider,
         description = p_description,
         instalment_count = p_instalment_count,
         interval_unit = p_interval_unit,
         interval_count = p_interval_count,
         down_payment_percentage = p_down_payment_percentage,
         interest_rate_percentage = p_interest_rate_percentage,
         partner_fee_percentage = p_partner_fee_percentage,
         late_fee_amount = p_late_fee_amount,
         grace_period_days = p_grace_period_days,
         minimum_invoice_amount = p_minimum_invoice_amount,
         maximum_invoice_amount = p_maximum_invoice_amount,
         currency = p_currency,
         requires_approval = coalesce(p_requires_approval, false),
         updated_by = public.current_user_id(),
         updated_at = now()
   where id = p_offer_id;

  return p_offer_id;
end;
$$;

comment on function public.save_instalment_offer(
  uuid, text, smallint, uuid, text, text, text, smallint, numeric, numeric,
  numeric, numeric, smallint, numeric, numeric, char, boolean
) is 'Creates or edits the instalment terms one business offers.';

create or replace function public.set_instalment_offer_active(
  p_offer_id uuid,
  p_is_active boolean
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_offer public.instalment_offers%rowtype;
begin
  select * into v_offer
    from public.instalment_offers
   where id = p_offer_id and deleted_at is null
     for update;

  if not found then
    return false;
  end if;

  if v_offer.company_id is null then
    raise exception 'The terms the platform ships with cannot be switched off here'
      using errcode = '42501';
  end if;

  if not coalesce(
    public.is_service_role() or public.is_company_owner(v_offer.company_id),
    false
  ) then
    raise exception 'Only the account owner can set instalment terms'
      using errcode = '42501';
  end if;

  update public.instalment_offers
     set is_active = p_is_active,
         updated_by = public.current_user_id(),
         updated_at = now()
   where id = p_offer_id;

  return true;
end;
$$;

comment on function public.set_instalment_offer_active(uuid, boolean) is
  'Turns one set of instalment terms on or off.';

-- -----------------------------------------------------------------------------
-- What a particular invoice can be offered
-- -----------------------------------------------------------------------------

create or replace function public.offers_for_invoice(p_invoice_id uuid)
returns table (
  offer_id uuid,
  name text,
  provider text,
  instalment_count smallint,
  interval_unit text,
  interval_count smallint,
  down_payment_amount numeric,
  instalment_amount numeric,
  total_payable numeric,
  requires_approval boolean
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_invoice public.invoices%rowtype;
begin
  select * into v_invoice
    from public.invoices
   where id = p_invoice_id and deleted_at is null;

  if not found then
    return;
  end if;

  if not coalesce(
    public.is_service_role() or public.has_company_access(v_invoice.company_id),
    false
  ) then
    raise exception 'That invoice belongs to another business' using errcode = '42501';
  end if;

  return query
  select o.id,
         o.name,
         o.provider,
         o.instalment_count,
         o.interval_unit,
         o.interval_count,
         round(v_invoice.balance_due * o.down_payment_percentage / 100, 2),
         round(
           (
             (v_invoice.balance_due
              - round(v_invoice.balance_due * o.down_payment_percentage / 100, 2))
             * (1 + o.interest_rate_percentage / 100)
           ) / o.instalment_count,
           2
         ),
         round(
           round(v_invoice.balance_due * o.down_payment_percentage / 100, 2)
           + (v_invoice.balance_due
              - round(v_invoice.balance_due * o.down_payment_percentage / 100, 2))
             * (1 + o.interest_rate_percentage / 100),
           2
         ),
         o.requires_approval
    from public.instalment_offers as o
   where o.deleted_at is null
     and o.is_active
     and (o.company_id = v_invoice.company_id or o.company_id is null)
     and o.currency = v_invoice.currency
     and v_invoice.balance_due >= o.minimum_invoice_amount
     and (o.maximum_invoice_amount is null
          or v_invoice.balance_due <= o.maximum_invoice_amount)
   order by o.instalment_count;
end;
$$;

comment on function public.offers_for_invoice(uuid) is
  'Lists the instalment terms one invoice qualifies for, priced out.';

-- -----------------------------------------------------------------------------
-- The plans themselves
-- -----------------------------------------------------------------------------

create or replace function public.company_instalment_plans(
  p_company_id uuid,
  p_status text default null,
  p_limit integer default 50
)
returns table (
  plan_id uuid,
  plan_reference text,
  status text,
  provider text,
  invoice_id uuid,
  invoice_number text,
  client_id uuid,
  client_name text,
  currency char(3),
  total_amount numeric,
  paid_amount numeric,
  outstanding_amount numeric,
  instalment_count smallint,
  paid_count smallint,
  first_due_date date,
  final_due_date date,
  next_due_date date,
  overdue_count integer,
  requires_decision boolean
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not coalesce(
    public.is_service_role() or public.has_company_access(p_company_id),
    false
  ) then
    raise exception 'Those plans belong to another business' using errcode = '42501';
  end if;

  return query
  select p.id,
         p.plan_reference,
         p.status,
         p.provider,
         p.invoice_id,
         i.invoice_number,
         p.client_id,
         c.display_name,
         p.currency,
         p.total_amount,
         p.paid_amount,
         p.outstanding_amount,
         p.instalment_count,
         p.paid_count,
         p.first_due_date,
         p.final_due_date,
         (
           select min(s.due_date)
             from public.instalment_schedule_items as s
            where s.plan_id = p.id
              and s.status in ('scheduled', 'due', 'partially_paid', 'overdue')
         ),
         (
           select count(*)::int
             from public.instalment_schedule_items as s
            where s.plan_id = p.id and s.status = 'overdue'
         ),
         p.status = 'pending'
    from public.instalment_plans as p
    left join public.invoices as i on i.id = p.invoice_id
    left join public.clients as c on c.id = p.client_id
   where p.company_id = p_company_id
     and (p_status is null or p.status = p_status)
   order by p.created_at desc
   limit greatest(1, least(coalesce(p_limit, 50), 200));
end;
$$;

comment on function public.company_instalment_plans(uuid, text, integer) is
  'Lists the instalment plans of one business, newest first.';

create or replace function public.instalment_plan_detail(p_plan_id uuid)
returns jsonb
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
    return null;
  end if;

  if not coalesce(
    public.is_service_role() or public.has_company_access(v_plan.company_id),
    false
  ) then
    raise exception 'That plan is not yours to read' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'plan_id', v_plan.id,
    'plan_reference', v_plan.plan_reference,
    'status', v_plan.status,
    'provider', v_plan.provider,
    'invoice_id', v_plan.invoice_id,
    'invoice_number', (
      select i.invoice_number from public.invoices as i where i.id = v_plan.invoice_id
    ),
    'client_id', v_plan.client_id,
    'client_name', (
      select c.display_name from public.clients as c where c.id = v_plan.client_id
    ),
    'currency', v_plan.currency,
    'total_amount', v_plan.total_amount,
    'down_payment_amount', v_plan.down_payment_amount,
    'financed_amount', v_plan.financed_amount,
    'interest_amount', v_plan.interest_amount,
    'partner_fee_amount', v_plan.partner_fee_amount,
    'net_settlement_amount', v_plan.net_settlement_amount,
    'paid_amount', v_plan.paid_amount,
    'outstanding_amount', v_plan.outstanding_amount,
    'instalment_count', v_plan.instalment_count,
    'paid_count', v_plan.paid_count,
    'first_due_date', v_plan.first_due_date,
    'final_due_date', v_plan.final_due_date,
    'approval_decision', v_plan.approval_decision,
    'declined_reason', v_plan.declined_reason,
    'cancellation_reason', v_plan.cancellation_reason,
    'defaulted_at', v_plan.defaulted_at,
    'completed_at', v_plan.completed_at,
    'schedule', coalesce(
      (
        select jsonb_agg(
                 jsonb_build_object(
                   'schedule_item_id', s.id,
                   'instalment_number', s.instalment_number,
                   'due_date', s.due_date,
                   'amount', s.amount,
                   'principal_amount', s.principal_amount,
                   'interest_amount', s.interest_amount,
                   'paid_amount', s.paid_amount,
                   'late_fee_amount', s.late_fee_amount,
                   'status', s.status,
                   'paid_at', s.paid_at,
                   'last_failure_reason', s.last_failure_reason
                 )
                 order by s.instalment_number
               )
          from public.instalment_schedule_items as s
         where s.plan_id = v_plan.id
      ),
      '[]'::jsonb
    )
  );
end;
$$;

comment on function public.instalment_plan_detail(uuid) is
  'Returns one instalment plan with its whole schedule.';

create or replace function public.instalment_overview(p_company_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if not coalesce(
    public.is_service_role() or public.has_company_access(p_company_id),
    false
  ) then
    raise exception 'That business is not yours to read' using errcode = '42501';
  end if;

  select jsonb_build_object(
           'pending_count', (count(*) filter (where status = 'pending'))::int,
           'active_count', (count(*) filter (where status = 'active'))::int,
           'completed_count', (count(*) filter (where status = 'completed'))::int,
           'defaulted_count', (count(*) filter (where status = 'defaulted'))::int,
           'outstanding_amount', coalesce(
             sum(outstanding_amount) filter (where status in ('pending', 'active')), 0
           ),
           'collected_amount', coalesce(sum(paid_amount), 0),
           'overdue_instalments', (
             select count(*)::int
               from public.instalment_schedule_items as s
               join public.instalment_plans as p2 on p2.id = s.plan_id
              where p2.company_id = p_company_id and s.status = 'overdue'
           )
         )
    into v_result
    from public.instalment_plans
   where company_id = p_company_id;

  return coalesce(v_result, '{}'::jsonb);
end;
$$;

comment on function public.instalment_overview(uuid) is
  'Counts the instalment plans of one business and what they are worth.';

-- -----------------------------------------------------------------------------
-- Who may run what
-- -----------------------------------------------------------------------------

revoke execute on function public.company_instalment_offers(uuid)
  from public, authenticated;
revoke execute on function public.save_instalment_offer(
  uuid, text, smallint, uuid, text, text, text, smallint, numeric, numeric,
  numeric, numeric, smallint, numeric, numeric, char, boolean
) from public, authenticated;
revoke execute on function public.set_instalment_offer_active(uuid, boolean)
  from public, authenticated;
revoke execute on function public.offers_for_invoice(uuid)
  from public, authenticated;
revoke execute on function public.company_instalment_plans(uuid, text, integer)
  from public, authenticated;
revoke execute on function public.instalment_plan_detail(uuid)
  from public, authenticated;
revoke execute on function public.instalment_overview(uuid)
  from public, authenticated;

grant execute on function public.company_instalment_offers(uuid)
  to authenticated, service_role;
grant execute on function public.save_instalment_offer(
  uuid, text, smallint, uuid, text, text, text, smallint, numeric, numeric,
  numeric, numeric, smallint, numeric, numeric, char, boolean
) to authenticated, service_role;
grant execute on function public.set_instalment_offer_active(uuid, boolean)
  to authenticated, service_role;
grant execute on function public.offers_for_invoice(uuid)
  to authenticated, service_role;
grant execute on function public.company_instalment_plans(uuid, text, integer)
  to authenticated, service_role;
grant execute on function public.instalment_plan_detail(uuid)
  to authenticated, service_role;
grant execute on function public.instalment_overview(uuid)
  to authenticated, service_role;
