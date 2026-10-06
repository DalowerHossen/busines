-- supabase/migrations/00104_create_time_entries.sql
-- Tracked time: the raw material a service business invoices.
--
-- Two ways in are supported, a running timer and a typed entry, and both end
-- up in the same shape. Once an entry has been invoiced it is frozen, because
-- it is then part of a document a client has seen.

create table public.time_entries (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  project_id uuid not null,
  task_id uuid,
  user_id uuid not null,

  entry_date date not null default current_date,
  started_at timestamptz,
  ended_at timestamptz,
  duration_minutes integer not null default 0,

  description text not null,

  is_billable boolean not null default true,
  hourly_rate numeric(18, 4) not null default 0,
  billable_amount numeric(18, 4) not null default 0,
  cost_rate numeric(18, 4) not null default 0,
  cost_amount numeric(18, 4) not null default 0,

  -- Approval, when the tenant runs timesheets.
  status public.approval_status not null default 'pending',
  timesheet_id uuid,

  -- Billing state.
  invoice_id uuid,
  invoice_item_id uuid,
  invoiced_at timestamptz,
  -- Set when the hours were covered by a retainer rather than invoiced.
  retainer_period_id uuid,

  entry_source text not null default 'manual',
  is_running boolean not null generated always as (ended_at is null and started_at is not null) stored,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint time_entries_description_check
    check (length(btrim(description)) between 2 and 300),
  constraint time_entries_duration_check
    check (duration_minutes >= 0 and duration_minutes <= 1440),
  constraint time_entries_period_check
    check (ended_at is null or started_at is null or ended_at > started_at),
  constraint time_entries_amounts_check
    check (hourly_rate >= 0 and billable_amount >= 0
           and cost_rate >= 0 and cost_amount >= 0),
  constraint time_entries_source_check
    check (entry_source in ('manual', 'timer', 'import', 'calendar')),
  -- A running timer has no duration yet; a finished entry has one.
  constraint time_entries_finished_check
    check (started_at is null or ended_at is not null or duration_minutes = 0),
  constraint time_entries_invoiced_check
    check (invoice_id is null or invoiced_at is not null),
  -- Work given away free is never charged.
  constraint time_entries_billable_check
    check (is_billable or billable_amount = 0)
);

comment on table public.time_entries is
  'One block of tracked work, billable or not, by one person on one project.';

create index time_entries_project_idx
  on public.time_entries (project_id, entry_date)
  where deleted_at is null;

create index time_entries_user_idx
  on public.time_entries (user_id, entry_date)
  where deleted_at is null;

create index time_entries_task_idx
  on public.time_entries (task_id)
  where task_id is not null and deleted_at is null;

-- The queue the billing screen reads: approved, billable, not yet invoiced.
create index time_entries_unbilled_idx
  on public.time_entries (company_id, project_id, entry_date)
  where is_billable and invoice_id is null and deleted_at is null;

create index time_entries_timesheet_idx
  on public.time_entries (timesheet_id)
  where timesheet_id is not null;

-- One person can only be running one timer at a time.
create unique index time_entries_single_timer
  on public.time_entries (user_id)
  where ended_at is null and started_at is not null and deleted_at is null;

-- -----------------------------------------------------------------------------
-- The timer
-- -----------------------------------------------------------------------------

-- Starts the clock. The rate is captured now, so a later rate change does not
-- silently rewrite work that has already been done.
create or replace function public.start_time_entry(
  p_project_id uuid,
  p_description text,
  p_task_id uuid default null,
  p_is_billable boolean default true
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_project public.projects%rowtype;
  v_user_id uuid := public.current_user_id();
  v_entry_id uuid;
begin
  if v_user_id is null then
    raise exception 'Please sign in before starting a timer' using errcode = '42501';
  end if;

  select * into v_project
    from public.projects
   where id = p_project_id and deleted_at is null;

  if not found then
    raise exception 'Project % was not found', p_project_id using errcode = 'P0002';
  end if;

  if not public.can_write_company_data(v_project.company_id) then
    raise exception 'You do not have permission to log time on this project'
      using errcode = '42501';
  end if;

  if v_project.status in ('completed', 'cancelled') then
    raise exception 'Time cannot be logged against a closed project'
      using errcode = '22023';
  end if;

  if exists (
    select 1 from public.time_entries
     where user_id = v_user_id
       and started_at is not null
       and ended_at is null
       and deleted_at is null
  ) then
    raise exception 'A timer is already running. Stop it before starting another.'
      using errcode = '22023';
  end if;

  insert into public.time_entries (
    company_id, project_id, task_id, user_id, entry_date, started_at,
    description, is_billable, hourly_rate, cost_rate, entry_source, created_by
  )
  values (
    v_project.company_id, p_project_id, p_task_id, v_user_id, current_date, now(),
    p_description,
    p_is_billable and v_project.is_billable,
    public.project_hourly_rate(p_project_id, v_user_id),
    public.project_cost_rate(p_project_id, v_user_id),
    'timer', v_user_id
  )
  returning id into v_entry_id;

  return v_entry_id;
end;
$$;

comment on function public.start_time_entry(uuid, text, uuid, boolean) is
  'Starts a timer for the signed in person, one at a time.';

-- Stops the running timer and turns the elapsed time into minutes.
create or replace function public.stop_time_entry(
  p_entry_id uuid default null
)
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_entry public.time_entries%rowtype;
  v_minutes integer;
begin
  select * into v_entry
    from public.time_entries
   where (p_entry_id is null or id = p_entry_id)
     and user_id = public.current_user_id()
     and started_at is not null
     and ended_at is null
     and deleted_at is null
   order by started_at
   limit 1
     for update;

  if not found then
    raise exception 'No timer is running' using errcode = 'P0002';
  end if;

  v_minutes := greatest(
    1,
    ceil(extract(epoch from (now() - v_entry.started_at)) / 60)::integer
  );

  update public.time_entries
     set ended_at = now(),
         duration_minutes = least(v_minutes, 1440),
         updated_at = now()
   where id = v_entry.id;

  return least(v_minutes, 1440);
end;
$$;

comment on function public.stop_time_entry(uuid) is
  'Stops the running timer and records the minutes worked.';

-- Records work that was done away from the keyboard.
create or replace function public.log_time_entry(
  p_project_id uuid,
  p_minutes integer,
  p_description text,
  p_entry_date date default current_date,
  p_task_id uuid default null,
  p_is_billable boolean default true
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_project public.projects%rowtype;
  v_user_id uuid := public.current_user_id();
  v_entry_id uuid;
begin
  if p_minutes is null or p_minutes <= 0 then
    raise exception 'Logged time must be greater than zero' using errcode = '22023';
  end if;

  select * into v_project
    from public.projects
   where id = p_project_id and deleted_at is null;

  if not found then
    raise exception 'Project % was not found', p_project_id using errcode = 'P0002';
  end if;

  if not public.can_write_company_data(v_project.company_id) then
    raise exception 'You do not have permission to log time on this project'
      using errcode = '42501';
  end if;

  insert into public.time_entries (
    company_id, project_id, task_id, user_id, entry_date, duration_minutes,
    description, is_billable, hourly_rate, cost_rate, entry_source, created_by
  )
  values (
    v_project.company_id, p_project_id, p_task_id, v_user_id, p_entry_date,
    least(p_minutes, 1440), p_description,
    p_is_billable and v_project.is_billable,
    public.project_hourly_rate(p_project_id, v_user_id),
    public.project_cost_rate(p_project_id, v_user_id),
    'manual', v_user_id
  )
  returning id into v_entry_id;

  return v_entry_id;
end;
$$;

comment on function public.log_time_entry(uuid, integer, text, date, uuid, boolean) is
  'Records a block of work that was not timed live.';

-- What one person logged over a period, for the weekly view.
create or replace function public.time_summary(
  p_company_id uuid,
  p_from date,
  p_to date,
  p_user_id uuid default null
)
returns table (
  project_id uuid,
  project_name text,
  logged_hours numeric,
  billable_hours numeric,
  billable_amount numeric
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id,
         p.name,
         round(sum(e.duration_minutes) / 60.0, 2),
         round(sum(e.duration_minutes) filter (where e.is_billable) / 60.0, 2),
         round(coalesce(sum(e.billable_amount), 0), 4)
    from public.time_entries as e
    join public.projects as p on p.id = e.project_id
   where e.company_id = p_company_id
     and e.deleted_at is null
     and e.entry_date between p_from and p_to
     and (p_user_id is null or e.user_id = p_user_id)
   group by p.id, p.name
   order by p.name;
$$;

comment on function public.time_summary(uuid, date, date, uuid) is
  'Totals logged and billable hours per project over a period.';
