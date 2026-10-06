-- supabase/migrations/00133_announcement_bars.sql
-- Scheduled, dismissible announcement bars for platform and tenant surfaces.

create table public.announcement_bars (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid null references public.companies (id),
  message text not null,
  link_url text null,
  link_label text null,
  severity text not null default 'info',
  is_dismissible boolean not null default true,
  is_active boolean not null default false,
  starts_at timestamptz null,
  ends_at timestamptz null,
  priority integer not null default 0,
  created_by_user_id uuid null references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint announcement_bars_message_not_blank check (length(btrim(message)) > 0),
  constraint announcement_bars_severity_valid check (severity in ('info', 'success', 'warning', 'critical')),
  constraint announcement_bars_date_window_valid check (
    ends_at is null or starts_at is null or ends_at > starts_at
  )
);

create index announcement_bars_active_idx
  on public.announcement_bars (company_id, priority desc, starts_at)
  where is_active = true and deleted_at is null;
create index announcement_bars_schedule_idx
  on public.announcement_bars (starts_at, ends_at)
  where deleted_at is null;

comment on table public.announcement_bars is
  'A scheduled and dismissible platform or tenant announcement bar.';
