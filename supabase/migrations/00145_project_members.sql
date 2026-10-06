-- supabase/migrations/00145_project_members.sql
-- Staff and accountant assignments to a project.

create table public.project_members (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.users (id),
  hourly_rate_amount numeric(18, 4) null,
  is_billable boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint project_members_hourly_rate_non_negative check (
    hourly_rate_amount is null or hourly_rate_amount >= 0
  )
);

create unique index project_members_project_user_key
  on public.project_members (project_id, user_id)
  where deleted_at is null;
create index project_members_company_user_idx
  on public.project_members (company_id, user_id)
  where deleted_at is null;

comment on table public.project_members is
  'A user assignment and optional billable rate for one tenant project.';
