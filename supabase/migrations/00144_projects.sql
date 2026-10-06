-- supabase/migrations/00144_projects.sql
-- Service-business project/job tracking connected to a client and later to
-- billable time entries and invoices.

create table public.projects (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  client_id uuid null references public.clients (id),
  project_code text not null,
  name text not null,
  description text null,
  status project_status not null default 'planning',
  start_date date null,
  due_date date null,
  budget_hours numeric(18, 4) null,
  hourly_rate_amount numeric(18, 4) null,
  currency_code text not null default 'USD',
  created_by_user_id uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint projects_code_not_blank check (length(btrim(project_code)) > 0),
  constraint projects_name_not_blank check (length(btrim(name)) > 0),
  constraint projects_date_window_valid check (due_date is null or start_date is null or due_date >= start_date),
  constraint projects_budget_hours_non_negative check (budget_hours is null or budget_hours >= 0),
  constraint projects_hourly_rate_non_negative check (hourly_rate_amount is null or hourly_rate_amount >= 0)
);

create unique index projects_company_code_key
  on public.projects (company_id, lower(project_code))
  where deleted_at is null;
create index projects_company_client_idx
  on public.projects (company_id, client_id, status)
  where deleted_at is null;
create index projects_due_date_idx
  on public.projects (company_id, due_date)
  where due_date is not null and deleted_at is null;

comment on table public.projects is
  'A tenant service-business project or job with optional client and budget/rate fields.';
