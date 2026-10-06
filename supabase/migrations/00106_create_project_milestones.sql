-- supabase/migrations/00106_create_project_milestones.sql
-- Milestone billing: a fixed price job invoiced in agreed stages.
--
-- A milestone is only billable once it has been delivered, so the status has
-- to pass through completed before it can reach an invoice.

create table public.project_milestones (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  project_id uuid not null,

  name text not null,
  description text,
  status text not null default 'pending',

  amount numeric(18, 4) not null default 0,
  -- Either a share of the fixed price or a flat amount; the share is kept for
  -- the proposal document the client signed.
  percentage_of_project numeric(7, 4),

  due_date date,
  sort_order smallint not null default 0,

  completed_at timestamptz,
  completed_by uuid,
  approved_by_client_at timestamptz,

  invoice_id uuid,
  invoiced_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint project_milestones_name_check
    check (length(btrim(name)) between 2 and 160),
  constraint project_milestones_status_check
    check (status in ('pending', 'in_progress', 'completed', 'invoiced',
                      'cancelled')),
  constraint project_milestones_amount_check
    check (amount >= 0),
  constraint project_milestones_percentage_check
    check (percentage_of_project is null
           or percentage_of_project between 0 and 100),
  constraint project_milestones_completed_check
    check (status not in ('completed', 'invoiced') or completed_at is not null),
  constraint project_milestones_invoiced_check
    check (status <> 'invoiced' or invoice_id is not null)
);

comment on table public.project_milestones is
  'A billable stage of a fixed price project.';

create index project_milestones_project_idx
  on public.project_milestones (project_id, sort_order)
  where deleted_at is null;

-- The queue the billing screen reads: delivered but not yet invoiced.
create index project_milestones_billable_idx
  on public.project_milestones (company_id, project_id)
  where status = 'completed' and invoice_id is null and deleted_at is null;

-- -----------------------------------------------------------------------------
-- Milestone lifecycle
-- -----------------------------------------------------------------------------

-- Marks a stage delivered, which is what makes it billable.
create or replace function public.complete_milestone(
  p_milestone_id uuid,
  p_completed_on date default current_date
)
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_milestone public.project_milestones%rowtype;
begin
  select * into v_milestone
    from public.project_milestones
   where id = p_milestone_id and deleted_at is null for update;

  if not found then
    raise exception 'Milestone % was not found', p_milestone_id
      using errcode = 'P0002';
  end if;

  if not public.can_write_company_data(v_milestone.company_id) then
    raise exception 'You do not have permission to change this milestone'
      using errcode = '42501';
  end if;

  if v_milestone.status in ('invoiced', 'cancelled') then
    raise exception 'This milestone is closed' using errcode = '22023';
  end if;

  update public.project_milestones
     set status = 'completed',
         completed_at = p_completed_on::timestamptz,
         completed_by = public.current_user_id(),
         updated_at = now()
   where id = p_milestone_id;

  return 'completed';
end;
$$;

comment on function public.complete_milestone(uuid, date) is
  'Marks a milestone delivered so that it can be invoiced.';

-- How much of a project has been agreed, delivered and billed.
create or replace function public.milestone_progress(p_project_id uuid)
returns table (
  agreed_amount numeric,
  completed_amount numeric,
  invoiced_amount numeric,
  remaining_amount numeric
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select round(coalesce(sum(amount) filter (where status <> 'cancelled'), 0), 4),
         round(coalesce(sum(amount) filter
                        (where status in ('completed', 'invoiced')), 0), 4),
         round(coalesce(sum(amount) filter (where status = 'invoiced'), 0), 4),
         round(coalesce(sum(amount) filter
                        (where status in ('pending', 'in_progress')), 0), 4)
    from public.project_milestones
   where project_id = p_project_id
     and deleted_at is null;
$$;

comment on function public.milestone_progress(uuid) is
  'Totals the agreed, delivered and billed value of a project by stage.';
