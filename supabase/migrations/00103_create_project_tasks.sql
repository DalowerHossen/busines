-- supabase/migrations/00103_create_project_tasks.sql
-- The work breakdown of a project.
--
-- Tasks exist so that time can be logged against something a client would
-- recognise on an invoice, and so that a project manager can see what is left.

create table public.project_tasks (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  project_id uuid not null,
  parent_task_id uuid,

  name text not null,
  description text,
  status text not null default 'todo',
  priority text not null default 'normal',

  assignee_user_id uuid,
  estimated_hours numeric(12, 2),
  logged_hours numeric(12, 2) not null default 0,
  billable_hours numeric(12, 2) not null default 0,

  is_billable boolean not null default true,
  -- Overrides the project rate when this task is charged differently.
  hourly_rate numeric(18, 4),

  start_date date,
  due_date date,
  completed_at timestamptz,
  completed_by uuid,

  sort_order smallint not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint project_tasks_name_check
    check (length(btrim(name)) between 2 and 160),
  constraint project_tasks_status_check
    check (status in ('todo', 'in_progress', 'blocked', 'done', 'cancelled')),
  constraint project_tasks_priority_check
    check (priority in ('low', 'normal', 'high', 'urgent')),
  constraint project_tasks_hours_check
    check (coalesce(estimated_hours, 0) >= 0
           and logged_hours >= 0
           and billable_hours >= 0),
  constraint project_tasks_rate_check
    check (hourly_rate is null or hourly_rate >= 0),
  constraint project_tasks_parent_check
    check (parent_task_id is null or parent_task_id <> id),
  constraint project_tasks_dates_check
    check (due_date is null or start_date is null or due_date >= start_date),
  constraint project_tasks_done_check
    check (status <> 'done' or completed_at is not null)
);

comment on table public.project_tasks is
  'A unit of work inside a project that time can be logged against.';

create index project_tasks_project_idx
  on public.project_tasks (project_id, sort_order)
  where deleted_at is null;

create index project_tasks_assignee_idx
  on public.project_tasks (assignee_user_id, status)
  where assignee_user_id is not null and deleted_at is null;

create index project_tasks_open_idx
  on public.project_tasks (company_id, due_date)
  where status in ('todo', 'in_progress', 'blocked') and deleted_at is null;

create index project_tasks_parent_idx
  on public.project_tasks (parent_task_id)
  where parent_task_id is not null;

-- -----------------------------------------------------------------------------
-- Task lifecycle
-- -----------------------------------------------------------------------------

-- Marks a task finished, or reopens it, and keeps the stamps honest.
create or replace function public.set_task_status(
  p_task_id uuid,
  p_status text
)
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_task public.project_tasks%rowtype;
begin
  select * into v_task
    from public.project_tasks
   where id = p_task_id and deleted_at is null for update;

  if not found then
    raise exception 'Task % was not found', p_task_id using errcode = 'P0002';
  end if;

  if not public.can_write_company_data(v_task.company_id) then
    raise exception 'You do not have permission to change this task'
      using errcode = '42501';
  end if;

  if p_status not in ('todo', 'in_progress', 'blocked', 'done', 'cancelled') then
    raise exception 'A task cannot be set to the state %', p_status
      using errcode = '22023';
  end if;

  update public.project_tasks
     set status = p_status,
         completed_at = case when p_status = 'done' then now() else null end,
         completed_by = case
                          when p_status = 'done' then public.current_user_id()
                          else null
                        end,
         updated_at = now()
   where id = p_task_id;

  return p_status;
end;
$$;

comment on function public.set_task_status(uuid, text) is
  'Moves a task through its states and records who finished it.';

-- A short board view: what is open on a project and how it is tracking.
create or replace function public.project_task_summary(p_project_id uuid)
returns table (
  status text,
  task_count integer,
  estimated_hours numeric,
  logged_hours numeric
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select t.status,
         count(*)::integer,
         round(coalesce(sum(t.estimated_hours), 0), 2),
         round(coalesce(sum(t.logged_hours), 0), 2)
    from public.project_tasks as t
   where t.project_id = p_project_id
     and t.deleted_at is null
   group by t.status
   order by t.status;
$$;

comment on function public.project_task_summary(uuid) is
  'Counts the tasks of a project by state, with their hours.';
