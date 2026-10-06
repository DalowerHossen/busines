-- supabase/migrations/00107_create_retainers.sql
-- Retainers: a fixed fee each period that buys an agreed block of hours.
--
-- The agreement holds the terms, and one period row per cycle holds what was
-- actually used. Hours beyond the block are charged at the overage rate, and
-- unused hours either expire or roll forward, exactly as the contract says.

create table public.retainer_agreements (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  client_id uuid not null,
  project_id uuid,

  name text not null,
  status text not null default 'active',

  billing_period text not null default 'monthly',
  currency char(3) not null default 'USD',
  amount numeric(18, 4) not null,
  included_hours numeric(12, 2) not null default 0,
  overage_hourly_rate numeric(18, 4),
  rollover_unused_hours boolean not null default false,
  -- Unused hours expire after this many periods when rollover is on.
  rollover_expiry_periods smallint not null default 1,

  start_date date not null default current_date,
  end_date date,
  next_billing_date date,
  auto_renew boolean not null default true,
  -- Invoice the fee at the start of the period or at the end of it.
  bill_in_advance boolean not null default true,

  notes text,
  ended_at timestamptz,
  end_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint retainer_agreements_name_check
    check (length(btrim(name)) between 2 and 120),
  constraint retainer_agreements_status_check
    check (status in ('draft', 'active', 'paused', 'ended')),
  constraint retainer_agreements_period_check
    check (billing_period in ('weekly', 'monthly', 'quarterly', 'yearly')),
  constraint retainer_agreements_currency_check
    check (currency ~ '^[A-Z]{3}$'),
  constraint retainer_agreements_amount_check
    check (amount >= 0 and included_hours >= 0
           and coalesce(overage_hourly_rate, 0) >= 0),
  constraint retainer_agreements_rollover_check
    check (rollover_expiry_periods between 1 and 12),
  constraint retainer_agreements_dates_check
    check (end_date is null or end_date >= start_date),
  constraint retainer_agreements_ended_check
    check (status <> 'ended' or ended_at is not null)
);

comment on table public.retainer_agreements is
  'A recurring fee that buys an agreed block of hours each period.';

create index retainer_agreements_company_idx
  on public.retainer_agreements (company_id, status)
  where deleted_at is null;

create index retainer_agreements_client_idx
  on public.retainer_agreements (client_id)
  where deleted_at is null;

-- The queue the billing job reads.
create index retainer_agreements_due_idx
  on public.retainer_agreements (next_billing_date)
  where status = 'active' and deleted_at is null;

-- -----------------------------------------------------------------------------
-- One cycle of a retainer
-- -----------------------------------------------------------------------------

create table public.retainer_periods (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  agreement_id uuid not null,

  period_start date not null,
  period_end date not null,
  status text not null default 'open',

  included_hours numeric(12, 2) not null default 0,
  rolled_over_hours numeric(12, 2) not null default 0,
  used_hours numeric(12, 2) not null default 0,
  overage_hours numeric(12, 2) not null default 0,
  remaining_hours numeric(12, 2) not null
    generated always as (
      greatest(included_hours + rolled_over_hours - used_hours, 0)
    ) stored,

  fee_amount numeric(18, 4) not null default 0,
  overage_amount numeric(18, 4) not null default 0,

  invoice_id uuid,
  invoiced_at timestamptz,
  closed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint retainer_periods_period_check
    check (period_end >= period_start),
  constraint retainer_periods_status_check
    check (status in ('open', 'closed', 'invoiced')),
  constraint retainer_periods_hours_check
    check (included_hours >= 0 and rolled_over_hours >= 0
           and used_hours >= 0 and overage_hours >= 0),
  constraint retainer_periods_amounts_check
    check (fee_amount >= 0 and overage_amount >= 0)
);

comment on table public.retainer_periods is
  'One cycle of a retainer, with the hours it included and the hours used.';

create unique index retainer_periods_cycle_key
  on public.retainer_periods (agreement_id, period_start);

create index retainer_periods_open_idx
  on public.retainer_periods (company_id, status, period_end);

-- -----------------------------------------------------------------------------
-- Running a retainer
-- -----------------------------------------------------------------------------

-- Opens the next cycle, carrying forward unused hours when the contract says
-- so. Calling it twice for the same cycle returns the cycle that exists.
create or replace function public.open_retainer_period(
  p_agreement_id uuid,
  p_period_start date default current_date
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_agreement public.retainer_agreements%rowtype;
  v_period_end date;
  v_previous public.retainer_periods%rowtype;
  v_rollover numeric := 0;
  v_period_id uuid;
begin
  select * into v_agreement
    from public.retainer_agreements
   where id = p_agreement_id and deleted_at is null;

  if not found then
    raise exception 'Retainer % was not found', p_agreement_id
      using errcode = 'P0002';
  end if;

  if v_agreement.status <> 'active' then
    raise exception 'This retainer is not active' using errcode = '22023';
  end if;

  select id into v_period_id
    from public.retainer_periods
   where agreement_id = p_agreement_id and period_start = p_period_start;

  if v_period_id is not null then
    return v_period_id;
  end if;

  v_period_end := case v_agreement.billing_period
                    when 'weekly' then p_period_start + 6
                    when 'monthly' then (p_period_start + interval '1 month')::date - 1
                    when 'quarterly' then (p_period_start + interval '3 months')::date - 1
                    else (p_period_start + interval '1 year')::date - 1
                  end;

  if v_agreement.rollover_unused_hours then
    select * into v_previous
      from public.retainer_periods
     where agreement_id = p_agreement_id
       and period_start < p_period_start
     order by period_start desc
     limit 1;

    if found then
      v_rollover := v_previous.remaining_hours;
    end if;
  end if;

  insert into public.retainer_periods (
    company_id, agreement_id, period_start, period_end, included_hours,
    rolled_over_hours, fee_amount
  )
  values (
    v_agreement.company_id, p_agreement_id, p_period_start, v_period_end,
    v_agreement.included_hours, v_rollover, v_agreement.amount
  )
  returning id into v_period_id;

  update public.retainer_agreements
     set next_billing_date = v_period_end + 1,
         updated_at = now()
   where id = p_agreement_id;

  return v_period_id;
end;
$$;

comment on function public.open_retainer_period(uuid, date) is
  'Opens the next cycle of a retainer and carries unused hours forward.';

-- Draws hours of tracked work against the open cycle. Anything past the
-- included block becomes overage, priced at the agreed rate.
create or replace function public.draw_retainer_hours(
  p_period_id uuid,
  p_hours numeric
)
returns numeric
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_period public.retainer_periods%rowtype;
  v_agreement public.retainer_agreements%rowtype;
  v_allowance numeric;
  v_overage numeric;
begin
  if p_hours is null or p_hours <= 0 then
    raise exception 'Drawn hours must be greater than zero' using errcode = '22023';
  end if;

  select * into v_period
    from public.retainer_periods
   where id = p_period_id for update;

  if not found then
    raise exception 'Retainer period % was not found', p_period_id
      using errcode = 'P0002';
  end if;

  if v_period.status <> 'open' then
    raise exception 'This retainer period is closed' using errcode = '22023';
  end if;

  select * into v_agreement
    from public.retainer_agreements
   where id = v_period.agreement_id;

  v_allowance := v_period.included_hours + v_period.rolled_over_hours;
  v_overage := greatest(v_period.used_hours + p_hours - v_allowance, 0);

  update public.retainer_periods
     set used_hours = used_hours + p_hours,
         overage_hours = v_overage,
         overage_amount = round(
           v_overage * coalesce(v_agreement.overage_hourly_rate, 0), 4
         ),
         updated_at = now()
   where id = p_period_id;

  return v_overage;
end;
$$;

comment on function public.draw_retainer_hours(uuid, numeric) is
  'Uses hours from a retainer cycle and prices anything beyond the block.';

-- Closes a cycle so that it can be invoiced and no more hours are drawn.
create or replace function public.close_retainer_period(p_period_id uuid)
returns numeric
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_period public.retainer_periods%rowtype;
begin
  select * into v_period
    from public.retainer_periods
   where id = p_period_id for update;

  if not found then
    raise exception 'Retainer period % was not found', p_period_id
      using errcode = 'P0002';
  end if;

  if not (public.is_service_role()
          or public.can_write_company_data(v_period.company_id)) then
    raise exception 'You do not have permission to close this period'
      using errcode = '42501';
  end if;

  if v_period.status <> 'open' then
    return v_period.fee_amount + v_period.overage_amount;
  end if;

  update public.retainer_periods
     set status = 'closed',
         closed_at = now(),
         updated_at = now()
   where id = p_period_id;

  return v_period.fee_amount + v_period.overage_amount;
end;
$$;

comment on function public.close_retainer_period(uuid) is
  'Closes a retainer cycle and returns the amount due for it.';
