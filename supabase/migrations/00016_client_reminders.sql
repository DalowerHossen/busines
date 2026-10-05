-- supabase/migrations/00016_client_reminders.sql
-- A scheduled follow-up reminder tied to a client (for example "call about
-- renewal"), assignable to any team member of the company.

create table public.client_reminders (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  client_id uuid not null references public.clients (id),
  assigned_to_user_id uuid not null references public.users (id),
  title text not null,
  due_at timestamptz not null,
  is_completed boolean not null default false,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create index client_reminders_company_id_idx on public.client_reminders (company_id) where deleted_at is null;
create index client_reminders_client_id_idx on public.client_reminders (client_id);
create index client_reminders_assigned_to_user_id_idx on public.client_reminders (assigned_to_user_id);
create index client_reminders_due_at_idx
  on public.client_reminders (due_at)
  where is_completed = false and deleted_at is null;

comment on table public.client_reminders is
  'A scheduled follow-up reminder tied to a client, assigned to a team member.';
