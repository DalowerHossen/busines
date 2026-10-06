-- supabase/migrations/00102_create_projects.sql
-- Projects, the people on them, and the rates that decide what work is worth.
--
-- A service business bills work, not goods, so the project is the record the
-- rest of this module hangs from: time is logged against it, expenses are
-- recharged through it, milestones and retainers invoice from it.

-- An invoice can now say which project it settles, which is what makes the
-- project profitability report possible.
alter table public.invoices
  add column if not exists project_id uuid;

comment on column public.invoices.project_id is
  'The project this invoice bills, when the work was tracked as a project.';

create table public.projects (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  -- Internal work is allowed, so the client is optional.
  client_id uuid,

  project_code text not null,
  name text not null,
  description text,
  status public.project_status not null default 'planning',

  -- How the work turns into money.
  billing_type text not null default 'time_and_materials',
  currency char(3),
  fixed_price_amount numeric(18, 4),
  hourly_rate numeric(18, 4),
  -- Charged on top of recharged expenses.
  expense_markup_percentage numeric(7, 4) not null default 0,
  is_billable boolean not null default true,
  -- The catalogue line used when time becomes an invoice line.
  default_product_id uuid,

  budget_amount numeric(18, 4),
  budget_hours numeric(12, 2),
  -- Warn the owner when the budget is nearly gone.
  budget_alert_percentage smallint not null default 80,

  start_date date,
  end_date date,
  manager_user_id uuid,

  -- Running totals maintained by the triggers of this module.
  logged_hours numeric(12, 2) not null default 0,
  billable_hours numeric(12, 2) not null default 0,
  billed_amount numeric(18, 4) not null default 0,
  uninvoiced_amount numeric(18, 4) not null default 0,
  cost_amount numeric(18, 4) not null default 0,

  color text,
  notes text,
  completed_at timestamptz,
  archived_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint projects_code_check
    check (project_code ~ '^[A-Za-z0-9][A-Za-z0-9._/-]{1,31}$'),
  constraint projects_name_check
    check (length(btrim(name)) between 2 and 120),
  constraint projects_billing_type_check
    check (billing_type in ('time_and_materials', 'fixed_price', 'milestone',
                            'retainer', 'non_billable')),
  constraint projects_currency_check
    check (currency is null or currency ~ '^[A-Z]{3}$'),
  constraint projects_amounts_check
    check (coalesce(fixed_price_amount, 0) >= 0
           and coalesce(hourly_rate, 0) >= 0
           and coalesce(budget_amount, 0) >= 0
           and coalesce(budget_hours, 0) >= 0),
  constraint projects_markup_check
    check (expense_markup_percentage between 0 and 1000),
  constraint projects_alert_check
    check (budget_alert_percentage between 1 and 100),
  constraint projects_dates_check
    check (end_date is null or start_date is null or end_date >= start_date),
  -- A fixed price job has to say what the price is.
  constraint projects_fixed_price_check
    check (billing_type <> 'fixed_price' or fixed_price_amount is not null),
  constraint projects_billable_client_check
    check (not is_billable or client_id is not null)
);

comment on table public.projects is
  'A piece of client work that time, expenses and invoices are tracked against.';

create unique index projects_code_key
  on public.projects (company_id, project_code)
  where deleted_at is null;

create index projects_company_status_idx
  on public.projects (company_id, status)
  where deleted_at is null;

create index projects_client_idx
  on public.projects (client_id)
  where client_id is not null and deleted_at is null;

create index projects_manager_idx
  on public.projects (manager_user_id)
  where manager_user_id is not null and deleted_at is null;

-- -----------------------------------------------------------------------------
-- Who works on the project
-- -----------------------------------------------------------------------------

create table public.project_members (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  project_id uuid not null,
  user_id uuid not null,

  project_role text not null default 'member',
  -- What the client is charged for this person on this project.
  hourly_rate numeric(18, 4),
  -- What this person costs the business, used by the margin report.
  cost_rate numeric(18, 4),
  can_log_time boolean not null default true,
  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint project_members_role_check
    check (project_role in ('manager', 'member', 'viewer')),
  constraint project_members_rate_check
    check (coalesce(hourly_rate, 0) >= 0 and coalesce(cost_rate, 0) >= 0)
);

comment on table public.project_members is
  'The team on a project, with the rate each person is charged out at.';

create unique index project_members_unique
  on public.project_members (project_id, user_id)
  where deleted_at is null;

create index project_members_user_idx
  on public.project_members (user_id)
  where deleted_at is null;

-- -----------------------------------------------------------------------------
-- Numbering and rates
-- -----------------------------------------------------------------------------

-- Gives a project its reference, in the same shape as the other references.
create or replace function public.assign_project_code()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_next integer;
begin
  if new.project_code is not null and length(btrim(new.project_code)) > 0 then
    return new;
  end if;

  select coalesce(
           max(nullif(regexp_replace(project_code, '^PRJ-', ''), '')::integer),
           0
         ) + 1
    into v_next
    from public.projects
   where company_id = new.company_id
     and project_code ~ '^PRJ-[0-9]+$';

  new.project_code := 'PRJ-' || lpad(v_next::text, 4, '0');

  return new;
end;
$$;

comment on function public.assign_project_code() is
  'Gives a new project the next reference in the sequence of its tenant.';

-- Works out what an hour of this person on this project is worth.
-- The most specific rate wins: the person on the project, then the project,
-- then the default service in the catalogue.
create or replace function public.project_hourly_rate(
  p_project_id uuid,
  p_user_id uuid
)
returns numeric
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_project public.projects%rowtype;
  v_rate numeric;
begin
  select * into v_project from public.projects where id = p_project_id;

  if not found then
    return 0;
  end if;

  select hourly_rate into v_rate
    from public.project_members
   where project_id = p_project_id
     and user_id = p_user_id
     and deleted_at is null;

  if v_rate is not null then
    return v_rate;
  end if;

  if v_project.hourly_rate is not null then
    return v_project.hourly_rate;
  end if;

  if v_project.default_product_id is not null then
    select unit_price into v_rate
      from public.products
     where id = v_project.default_product_id;
  end if;

  return coalesce(v_rate, 0);
end;
$$;

comment on function public.project_hourly_rate(uuid, uuid) is
  'Returns the charge out rate for one person on one project.';

-- Returns what this person costs the business per hour on this project.
create or replace function public.project_cost_rate(
  p_project_id uuid,
  p_user_id uuid
)
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
           (select cost_rate
              from public.project_members
             where project_id = p_project_id
               and user_id = p_user_id
               and deleted_at is null),
           0
         );
$$;

comment on function public.project_cost_rate(uuid, uuid) is
  'Returns the internal cost of one hour of this person on this project.';
