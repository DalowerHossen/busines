-- supabase/migrations/00146_time_entries.sql
-- Timer or manually entered billable time. Duration is stored in seconds
-- for exact aggregation and avoids floating-point hour calculations.

create table public.time_entries (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  project_id uuid not null references public.projects (id),
  user_id uuid not null references public.users (id),
  invoice_id uuid null references public.invoices (id),
  description text not null,
  started_at timestamptz null,
  ended_at timestamptz null,
  duration_seconds integer not null default 0,
  hourly_rate_amount numeric(18, 4) not null default 0,
  currency_code text not null default 'USD',
  status time_entry_status not null default 'draft',
  is_billable boolean not null default true,
  billed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint time_entries_description_not_blank check (length(btrim(description)) > 0),
  constraint time_entries_duration_non_negative check (duration_seconds >= 0),
  constraint time_entries_hourly_rate_non_negative check (hourly_rate_amount >= 0),
  constraint time_entries_date_window_valid check (
    ended_at is null or started_at is null or ended_at >= started_at
  ),
  constraint time_entries_billed_fields_valid check (
    (status = 'billed' and invoice_id is not null and billed_at is not null)
    or status <> 'billed'
  )
);

create index time_entries_project_time_idx
  on public.time_entries (project_id, started_at desc)
  where deleted_at is null;
create index time_entries_user_status_idx
  on public.time_entries (company_id, user_id, status)
  where deleted_at is null;
create index time_entries_unbilled_idx
  on public.time_entries (company_id, project_id)
  where is_billable = true and invoice_id is null and deleted_at is null;

comment on table public.time_entries is
  'A manual or timer-generated project time entry stored with exact duration seconds.';
