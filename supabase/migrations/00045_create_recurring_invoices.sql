-- supabase/migrations/00045_create_recurring_invoices.sql
-- Recurring invoice schedules.
--
-- A schedule holds a template document and the rule that decides when the next
-- invoice is produced. Generation runs in the tenant time zone, so a monthly
-- invoice dated the first really is issued on the first for that company.

create table public.recurring_invoice_schedules (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  client_id uuid not null,

  name text not null,
  status public.recurring_schedule_status not null default 'draft',

  -- The draft invoice that is copied on every run.
  template_invoice_id uuid not null,

  frequency public.recurrence_frequency not null default 'monthly',
  interval_count smallint not null default 1,
  -- Used when the frequency is custom, expressed in days.
  custom_interval_days smallint,

  start_date date not null default current_date,
  end_date date,
  max_occurrences smallint,
  occurrences_generated smallint not null default 0,

  next_run_date date,
  last_run_date date,
  last_generated_invoice_id uuid,

  time_zone text not null default 'UTC',
  payment_terms_days smallint not null default 30,

  -- Delivery behaviour. Sending remains an owner level action, so a schedule
  -- that sends automatically is created by the owner.
  auto_issue boolean not null default true,
  auto_send boolean not null default false,
  send_to_contact_id uuid,
  days_before_to_create smallint not null default 0,

  -- Optional automatic collection through a saved payment method.
  auto_charge boolean not null default false,

  notes text,
  paused_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint recurring_schedules_name_check
    check (length(btrim(name)) between 1 and 120),
  constraint recurring_schedules_interval_check
    check (interval_count between 1 and 52),
  constraint recurring_schedules_custom_interval_check
    check (frequency <> 'custom' or custom_interval_days between 1 and 365),
  constraint recurring_schedules_period_check
    check (end_date is null or end_date >= start_date),
  constraint recurring_schedules_occurrences_check
    check (max_occurrences is null or max_occurrences between 1 and 1000),
  constraint recurring_schedules_lead_time_check
    check (days_before_to_create between 0 and 30),
  constraint recurring_schedules_terms_check
    check (payment_terms_days between 0 and 365)
);

comment on table public.recurring_invoice_schedules is
  'Rules that generate invoices automatically from a template document.';
comment on column public.recurring_invoice_schedules.template_invoice_id is
  'A permanent draft invoice that is copied each time the schedule runs.';

create index recurring_schedules_company_idx
  on public.recurring_invoice_schedules (company_id, status)
  where deleted_at is null;

create index recurring_schedules_due_idx
  on public.recurring_invoice_schedules (next_run_date)
  where deleted_at is null and status = 'active';

create index recurring_schedules_client_idx
  on public.recurring_invoice_schedules (client_id)
  where deleted_at is null;

create unique index recurring_schedules_template_unique
  on public.recurring_invoice_schedules (template_invoice_id)
  where deleted_at is null;

-- Returns the date the schedule should run after the supplied date.
create or replace function public.next_recurrence_date(
  p_schedule_id uuid,
  p_from date default current_date
)
returns date
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_schedule public.recurring_invoice_schedules%rowtype;
  v_next date;
begin
  select * into v_schedule
    from public.recurring_invoice_schedules
   where id = p_schedule_id;

  if not found then
    raise exception 'Schedule % was not found', p_schedule_id using errcode = 'P0002';
  end if;

  if v_schedule.frequency = 'custom' then
    v_next := p_from + make_interval(days => v_schedule.custom_interval_days);
  else
    v_next := public.add_recurrence(p_from, v_schedule.frequency, v_schedule.interval_count);
  end if;

  if v_schedule.end_date is not null and v_next > v_schedule.end_date then
    return null;
  end if;

  return v_next;
end;
$$;

comment on function public.next_recurrence_date(uuid, date) is
  'Returns the next run date of a schedule, or nothing when it has finished.';

-- Produces one invoice from a schedule and advances it.
create or replace function public.generate_recurring_invoice(p_schedule_id uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_schedule public.recurring_invoice_schedules%rowtype;
  v_issue_date date;
  v_invoice_id uuid;
  v_next date;
begin
  select * into v_schedule
    from public.recurring_invoice_schedules
   where id = p_schedule_id
     and deleted_at is null
     for update;

  if not found then
    raise exception 'Schedule % was not found', p_schedule_id using errcode = 'P0002';
  end if;

  if v_schedule.status <> 'active' then
    raise exception 'Only an active schedule can generate an invoice'
      using errcode = '42501';
  end if;

  if v_schedule.max_occurrences is not null
     and v_schedule.occurrences_generated >= v_schedule.max_occurrences then
    update public.recurring_invoice_schedules
       set status = 'completed', completed_at = now(), next_run_date = null, updated_at = now()
     where id = p_schedule_id;
    return null;
  end if;

  v_issue_date := coalesce(v_schedule.next_run_date, v_schedule.start_date);

  insert into public.invoices (
    company_id, client_id, client_contact_id, document_type, currency,
    currency_exponent, base_currency, exchange_rate, decimal_scale, rounding_mode,
    tax_mode, discount_stage, issue_date, due_date, payment_terms_days,
    discount_type, discount_value, shipping_amount, shipping_tax_rate_id,
    applies_reverse_charge, tax_note, notes, terms_and_conditions, footer_note,
    template_key, accent_color, recurring_schedule_id
  )
  select company_id, client_id, coalesce(v_schedule.send_to_contact_id, client_contact_id),
         'invoice', currency, currency_exponent, base_currency, exchange_rate,
         decimal_scale, rounding_mode, tax_mode, discount_stage, v_issue_date,
         v_issue_date + make_interval(days => v_schedule.payment_terms_days),
         v_schedule.payment_terms_days, discount_type, discount_value, shipping_amount,
         shipping_tax_rate_id, applies_reverse_charge, tax_note, notes,
         terms_and_conditions, footer_note, template_key, accent_color, p_schedule_id
    from public.invoices
   where id = v_schedule.template_invoice_id
  returning id into v_invoice_id;

  insert into public.invoice_items (
    company_id, invoice_id, line_number, line_type, product_id, sku_snapshot,
    description, long_description, quantity, unit_label, unit_price, discount_type,
    discount_value, tax_rate_id, tax_group_id, tax_name_snapshot, tax_percentage,
    is_tax_compound, is_taxable, cost_price_snapshot, metadata
  )
  select company_id, v_invoice_id, line_number, line_type, product_id, sku_snapshot,
         description, long_description, quantity, unit_label, unit_price, discount_type,
         discount_value, tax_rate_id, tax_group_id, tax_name_snapshot, tax_percentage,
         is_tax_compound, is_taxable, cost_price_snapshot, metadata
    from public.invoice_items
   where invoice_id = v_schedule.template_invoice_id
     and deleted_at is null
   order by line_number;

  perform public.recalculate_invoice_totals(v_invoice_id);

  if v_schedule.auto_issue then
    perform public.issue_invoice(v_invoice_id, v_issue_date);
  end if;

  v_next := public.next_recurrence_date(p_schedule_id, v_issue_date);

  update public.recurring_invoice_schedules
     set occurrences_generated = occurrences_generated + 1,
         last_run_date = v_issue_date,
         last_generated_invoice_id = v_invoice_id,
         next_run_date = v_next,
         status = case
                    when v_next is null then 'completed'
                    when max_occurrences is not null
                         and occurrences_generated + 1 >= max_occurrences then 'completed'
                    else status
                  end,
         completed_at = case
                          when v_next is null
                               or (max_occurrences is not null
                                   and occurrences_generated + 1 >= max_occurrences)
                          then now()
                          else completed_at
                        end,
         updated_at = now()
   where id = p_schedule_id;

  return v_invoice_id;
end;
$$;

comment on function public.generate_recurring_invoice(uuid) is
  'Creates the next invoice of a schedule and moves the schedule forward.';

-- Keeps the first run date sensible when a schedule is activated.
create or replace function public.set_schedule_next_run_date()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status = 'active' and new.next_run_date is null then
    new.next_run_date := greatest(new.start_date, current_date);
  end if;

  if new.status in ('paused', 'cancelled', 'completed') then
    new.next_run_date := null;
  end if;

  return new;
end;
$$;

comment on function public.set_schedule_next_run_date() is
  'Fills or clears the next run date when the state of a schedule changes.';

create trigger recurring_schedules_set_next_run
  before insert or update of status, start_date on public.recurring_invoice_schedules
  for each row execute function public.set_schedule_next_run_date();
