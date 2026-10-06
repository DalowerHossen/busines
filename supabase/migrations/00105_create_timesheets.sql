-- supabase/migrations/00105_create_timesheets.sql
-- Weekly timesheets and their approval.
--
-- Approval is the control that stops unchecked hours reaching a client
-- invoice: a person submits, the owner approves, and nobody approves their
-- own week.

create table public.timesheets (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  user_id uuid not null,

  period_start date not null,
  period_end date not null,
  status public.approval_status not null default 'pending',

  total_hours numeric(12, 2) not null default 0,
  billable_hours numeric(12, 2) not null default 0,
  entry_count integer not null default 0,

  submitted_at timestamptz,
  submitted_by uuid,
  approved_at timestamptz,
  approved_by uuid,
  rejected_at timestamptz,
  rejection_reason text,

  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint timesheets_period_check
    check (period_end >= period_start),
  constraint timesheets_hours_check
    check (total_hours >= 0 and billable_hours >= 0
           and billable_hours <= total_hours),
  constraint timesheets_rejected_check
    check (status <> 'rejected' or rejection_reason is not null),
  constraint timesheets_approved_check
    check (status <> 'approved' or approved_at is not null)
);

comment on table public.timesheets is
  'One period of tracked time by one person, submitted for approval.';

create unique index timesheets_period_key
  on public.timesheets (user_id, period_start)
  where deleted_at is null;

create index timesheets_company_status_idx
  on public.timesheets (company_id, status, period_start)
  where deleted_at is null;

-- -----------------------------------------------------------------------------
-- Building and submitting
-- -----------------------------------------------------------------------------

-- Recounts the hours on a timesheet from the entries attached to it.
create or replace function public.refresh_timesheet_totals(p_timesheet_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  update public.timesheets as t
     set total_hours = coalesce(totals.total_hours, 0),
         billable_hours = coalesce(totals.billable_hours, 0),
         entry_count = coalesce(totals.entry_count, 0),
         updated_at = now()
    from (
      select round(sum(e.duration_minutes) / 60.0, 2) as total_hours,
             round(sum(e.duration_minutes) filter (where e.is_billable) / 60.0, 2)
               as billable_hours,
             count(*)::integer as entry_count
        from public.time_entries as e
       where e.timesheet_id = p_timesheet_id
         and e.deleted_at is null
    ) as totals
   where t.id = p_timesheet_id;
end;
$$;

comment on function public.refresh_timesheet_totals(uuid) is
  'Recounts the hours of a timesheet from its entries.';

-- Collects the entries of one week into a timesheet. Running timers are left
-- alone, because the work is not finished yet.
create or replace function public.build_timesheet(
  p_user_id uuid,
  p_period_start date
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
  v_period_end date := p_period_start + 6;
  v_timesheet_id uuid;
begin
  select company_id into v_company_id from public.users where id = p_user_id;

  if v_company_id is null then
    raise exception 'That person does not belong to a company'
      using errcode = '22023';
  end if;

  if not (public.is_service_role() or public.can_write_company_data(v_company_id)) then
    raise exception 'You do not have permission to build this timesheet'
      using errcode = '42501';
  end if;

  select id into v_timesheet_id
    from public.timesheets
   where user_id = p_user_id
     and period_start = p_period_start
     and deleted_at is null;

  if v_timesheet_id is null then
    insert into public.timesheets (
      company_id, user_id, period_start, period_end, created_by
    )
    values (
      v_company_id, p_user_id, p_period_start, v_period_end,
      public.current_user_id()
    )
    returning id into v_timesheet_id;
  end if;

  if (select status from public.timesheets where id = v_timesheet_id) <> 'pending' then
    raise exception 'This timesheet has already been reviewed' using errcode = '22023';
  end if;

  -- A timer that is still running is not finished work, so it waits for the
  -- next build.
  update public.time_entries
     set timesheet_id = v_timesheet_id,
         updated_at = now()
   where user_id = p_user_id
     and entry_date between p_period_start and v_period_end
     and deleted_at is null
     and timesheet_id is null
     and (started_at is null or ended_at is not null);

  perform public.refresh_timesheet_totals(v_timesheet_id);

  return v_timesheet_id;
end;
$$;

comment on function public.build_timesheet(uuid, date) is
  'Gathers one week of finished entries into a timesheet.';


-- Hands the week in for review.
create or replace function public.submit_timesheet(p_timesheet_id uuid)
returns public.approval_status
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_timesheet public.timesheets%rowtype;
begin
  select * into v_timesheet
    from public.timesheets
   where id = p_timesheet_id and deleted_at is null for update;

  if not found then
    raise exception 'Timesheet % was not found', p_timesheet_id
      using errcode = 'P0002';
  end if;

  if v_timesheet.status <> 'pending' then
    raise exception 'This timesheet has already been reviewed' using errcode = '22023';
  end if;

  if v_timesheet.user_id <> public.current_user_id()
     and not public.is_company_owner(v_timesheet.company_id)
     and not public.is_super_admin() then
    raise exception 'A timesheet is submitted by the person who worked the hours'
      using errcode = '42501';
  end if;

  perform public.refresh_timesheet_totals(p_timesheet_id);

  update public.timesheets
     set submitted_at = now(),
         submitted_by = public.current_user_id(),
         updated_at = now()
   where id = p_timesheet_id;

  return 'pending'::public.approval_status;
end;
$$;

comment on function public.submit_timesheet(uuid) is
  'Marks a timesheet as handed in for review.';

-- Approves or rejects a submitted week. Approved hours become billable work.
create or replace function public.review_timesheet(
  p_timesheet_id uuid,
  p_approve boolean,
  p_reason text default null
)
returns public.approval_status
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_timesheet public.timesheets%rowtype;
  v_status public.approval_status;
begin
  select * into v_timesheet
    from public.timesheets
   where id = p_timesheet_id and deleted_at is null for update;

  if not found then
    raise exception 'Timesheet % was not found', p_timesheet_id
      using errcode = 'P0002';
  end if;

  if v_timesheet.status <> 'pending' then
    raise exception 'This timesheet has already been reviewed' using errcode = '22023';
  end if;

  if v_timesheet.submitted_at is null then
    raise exception 'This timesheet has not been handed in yet' using errcode = '22023';
  end if;

  if not (public.is_super_admin()
          or public.is_company_owner(v_timesheet.company_id)) then
    raise exception 'Only the account owner can approve a timesheet'
      using errcode = '42501';
  end if;

  if v_timesheet.user_id = public.current_user_id()
     and not public.is_super_admin() then
    raise exception 'A timesheet cannot be approved by the person who worked it'
      using errcode = '42501';
  end if;

  if not p_approve and coalesce(btrim(p_reason), '') = '' then
    raise exception 'Please say why the timesheet is being rejected'
      using errcode = '22023';
  end if;

  v_status := case when p_approve then 'approved'::public.approval_status
                   else 'rejected'::public.approval_status
              end;

  update public.timesheets
     set status = v_status,
         approved_at = case when p_approve then now() else null end,
         approved_by = case when p_approve then public.current_user_id() else null end,
         rejected_at = case when p_approve then null else now() end,
         rejection_reason = case when p_approve then null else p_reason end,
         updated_at = now()
   where id = p_timesheet_id;

  update public.time_entries
     set status = v_status,
         updated_at = now()
   where timesheet_id = p_timesheet_id
     and deleted_at is null;

  return v_status;
end;
$$;

comment on function public.review_timesheet(uuid, boolean, text) is
  'Approves or rejects a week of work, never by the person who worked it.';
