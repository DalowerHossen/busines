-- supabase/migrations/00112_install_project_triggers.sql
-- Timestamps, audit trails, rollups and the rules that keep tracked work
-- honest once it has been billed.

select public.install_standard_triggers('projects');
select public.install_standard_triggers('project_members');
select public.install_standard_triggers('project_tasks');
select public.install_standard_triggers('time_entries');
select public.install_standard_triggers('timesheets');
select public.install_standard_triggers('project_milestones');
select public.install_standard_triggers('retainer_agreements');
select public.install_standard_triggers('warehouses');
select public.install_standard_triggers('stock_counts');

select public.install_timestamp_trigger('retainer_periods');
select public.install_timestamp_trigger('stock_levels');
select public.install_timestamp_trigger('stock_count_items');

select public.install_audit_trigger('projects');
select public.install_audit_trigger('time_entries');
select public.install_audit_trigger('timesheets');
select public.install_audit_trigger('project_milestones');
select public.install_audit_trigger('retainer_agreements');
select public.install_audit_trigger('stock_counts');

create trigger projects_05_code
  before insert on public.projects
  for each row execute function public.assign_project_code();

-- -----------------------------------------------------------------------------
-- What tracked work is worth
-- -----------------------------------------------------------------------------

-- Prices an entry from its minutes and the rate captured when it was created.
create or replace function public.recalculate_time_entry_amounts()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_hours numeric;
begin
  v_hours := round(coalesce(new.duration_minutes, 0) / 60.0, 4);

  if new.is_billable then
    new.billable_amount := round(v_hours * coalesce(new.hourly_rate, 0), 4);
  else
    new.billable_amount := 0;
  end if;

  new.cost_amount := round(v_hours * coalesce(new.cost_rate, 0), 4);

  return new;
end;
$$;

comment on function public.recalculate_time_entry_amounts() is
  'Prices a block of tracked work from its minutes and its rate.';

create trigger time_entries_10_amounts
  before insert or update of duration_minutes, hourly_rate, cost_rate,
    is_billable on public.time_entries
  for each row execute function public.recalculate_time_entry_amounts();

-- Work that has reached an invoice is part of a document a client has seen,
-- so it stops being editable.
create or replace function public.guard_invoiced_time_entry()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.invoice_id is not null
     and (new.duration_minutes is distinct from old.duration_minutes
          or new.hourly_rate is distinct from old.hourly_rate
          or new.is_billable is distinct from old.is_billable
          or new.entry_date is distinct from old.entry_date
          or new.project_id is distinct from old.project_id)
     and new.invoice_id is not null then
    raise exception 'This work has been invoiced and can no longer be changed'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function public.guard_invoiced_time_entry() is
  'Freezes tracked work once it has appeared on an invoice.';

create trigger time_entries_20_invoiced_guard
  before update on public.time_entries
  for each row execute function public.guard_invoiced_time_entry();

-- -----------------------------------------------------------------------------
-- Rollups
-- -----------------------------------------------------------------------------

-- Keeps the hour counts on the task and the project in step with the entries.
create or replace function public.refresh_work_rollups()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_project_id uuid := coalesce(new.project_id, old.project_id);
  v_task_id uuid := coalesce(new.task_id, old.task_id);
  v_old_task_id uuid := old.task_id;
begin
  update public.projects as p
     set logged_hours = coalesce(totals.logged_hours, 0),
         billable_hours = coalesce(totals.billable_hours, 0),
         cost_amount = coalesce(totals.cost_amount, 0),
         uninvoiced_amount = coalesce(totals.uninvoiced_amount, 0),
         updated_at = now()
    from (
      select round(coalesce(sum(e.duration_minutes), 0) / 60.0, 2) as logged_hours,
             round(coalesce(sum(e.duration_minutes) filter
                            (where e.is_billable), 0) / 60.0, 2) as billable_hours,
             round(coalesce(sum(e.cost_amount), 0), 4) as cost_amount,
             round(coalesce(sum(e.billable_amount) filter
                            (where e.invoice_id is null), 0), 4) as uninvoiced_amount
        from public.time_entries as e
       where e.project_id = v_project_id
         and e.deleted_at is null
    ) as totals
   where p.id = v_project_id;

  if v_task_id is not null then
    update public.project_tasks as t
       set logged_hours = coalesce(totals.logged_hours, 0),
           billable_hours = coalesce(totals.billable_hours, 0),
           updated_at = now()
      from (
        select round(coalesce(sum(e.duration_minutes), 0) / 60.0, 2) as logged_hours,
               round(coalesce(sum(e.duration_minutes) filter
                              (where e.is_billable), 0) / 60.0, 2) as billable_hours
          from public.time_entries as e
         where e.task_id = v_task_id
           and e.deleted_at is null
      ) as totals
     where t.id = v_task_id;
  end if;

  if v_old_task_id is not null and v_old_task_id is distinct from v_task_id then
    update public.project_tasks as t
       set logged_hours = coalesce(totals.logged_hours, 0),
           billable_hours = coalesce(totals.billable_hours, 0),
           updated_at = now()
      from (
        select round(coalesce(sum(e.duration_minutes), 0) / 60.0, 2) as logged_hours,
               round(coalesce(sum(e.duration_minutes) filter
                              (where e.is_billable), 0) / 60.0, 2) as billable_hours
          from public.time_entries as e
         where e.task_id = v_old_task_id
           and e.deleted_at is null
      ) as totals
     where t.id = v_old_task_id;
  end if;

  return null;
end;
$$;

comment on function public.refresh_work_rollups() is
  'Recounts the hours held on the task and the project after a change.';

create trigger time_entries_30_rollups
  after insert or update or delete on public.time_entries
  for each row execute function public.refresh_work_rollups();

-- Keeps the timesheet totals right when entries move in or out of a week.
create or replace function public.refresh_timesheet_from_entry()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.timesheet_id is not null then
    perform public.refresh_timesheet_totals(new.timesheet_id);
  end if;

  if tg_op = 'UPDATE'
     and old.timesheet_id is not null
     and old.timesheet_id is distinct from new.timesheet_id then
    perform public.refresh_timesheet_totals(old.timesheet_id);
  end if;

  return null;
end;
$$;

comment on function public.refresh_timesheet_from_entry() is
  'Recounts a timesheet when one of its entries changes.';

create trigger time_entries_40_timesheet_totals
  after insert or update of timesheet_id, duration_minutes, is_billable
  on public.time_entries
  for each row execute function public.refresh_timesheet_from_entry();

-- Keeps the billed total of a project in step with its invoices.
create or replace function public.refresh_project_billed_amount()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_project_id uuid := coalesce(new.project_id, old.project_id);
begin
  if v_project_id is null then
    return null;
  end if;

  update public.projects as p
     set billed_amount = coalesce(totals.billed_amount, 0),
         updated_at = now()
    from (
      select round(coalesce(sum(i.total_amount), 0), 4) as billed_amount
        from public.invoices as i
       where i.project_id = v_project_id
         and i.deleted_at is null
         and i.status not in ('draft', 'cancelled')
    ) as totals
   where p.id = v_project_id;

  return null;
end;
$$;

comment on function public.refresh_project_billed_amount() is
  'Keeps the billed value held on a project in step with its invoices.';

create trigger invoices_95_project_billed
  after insert or update of status, total_amount, project_id
  on public.invoices
  for each row execute function public.refresh_project_billed_amount();

-- -----------------------------------------------------------------------------
-- Stock rules
-- -----------------------------------------------------------------------------

-- A movement is history. It is written once and never touched again.
create or replace function public.guard_stock_movement()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'Stock movements are a permanent record. Post a correcting movement instead.'
    using errcode = '42501';
end;
$$;

comment on function public.guard_stock_movement() is
  'Blocks edits and deletions of the stock history.';

create trigger stock_movements_10_append_only
  before update or delete on public.stock_movements
  for each row execute function public.guard_stock_movement();

-- Only one warehouse can be the default one.
create or replace function public.guard_default_warehouse()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.is_default then
    update public.warehouses
       set is_default = false,
           updated_at = now()
     where company_id = new.company_id
       and id <> new.id
       and is_default
       and deleted_at is null;
  end if;

  return new;
end;
$$;

comment on function public.guard_default_warehouse() is
  'Keeps exactly one default warehouse per tenant.';

create trigger warehouses_10_default_guard
  before insert or update of is_default on public.warehouses
  for each row execute function public.guard_default_warehouse();

-- A stock take line starts from what the system believes is there.
create or replace function public.set_stock_count_expected()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_warehouse_id uuid;
begin
  select warehouse_id into v_warehouse_id
    from public.stock_counts
   where id = new.stock_count_id;

  select coalesce(quantity_on_hand, 0), coalesce(nullif(new.unit_cost, 0), average_cost, 0)
    into new.expected_quantity, new.unit_cost
    from public.stock_levels
   where product_id = new.product_id
     and warehouse_id = v_warehouse_id;

  new.expected_quantity := coalesce(new.expected_quantity, 0);
  new.unit_cost := coalesce(new.unit_cost, 0);

  return new;
end;
$$;

comment on function public.set_stock_count_expected() is
  'Fills in what the records say is on hand when a count line is added.';

create trigger stock_count_items_05_expected
  before insert on public.stock_count_items
  for each row execute function public.set_stock_count_expected();
