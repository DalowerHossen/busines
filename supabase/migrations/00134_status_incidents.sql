-- supabase/migrations/00134_status_incidents.sql
-- Public status page services and incident history.

create type status_service_status as enum (
  'operational',
  'degraded',
  'partial_outage',
  'major_outage',
  'maintenance'
);

create type incident_status as enum (
  'investigating',
  'identified',
  'monitoring',
  'resolved'
);

create table public.status_services (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  slug text not null,
  description text null,
  status status_service_status not null default 'operational',
  sort_order integer not null default 0,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint status_services_name_not_blank check (length(btrim(name)) > 0),
  constraint status_services_slug_not_blank check (length(btrim(slug)) > 0),
  constraint status_services_sort_order_non_negative check (sort_order >= 0)
);

create unique index status_services_slug_key
  on public.status_services (lower(slug))
  where deleted_at is null;
create index status_services_public_order_idx
  on public.status_services (is_public, sort_order)
  where deleted_at is null;

create table public.status_incidents (
  id uuid primary key default extensions.gen_random_uuid(),
  title text not null,
  status incident_status not null default 'investigating',
  impact status_service_status not null default 'degraded',
  started_at timestamptz not null default now(),
  resolved_at timestamptz null,
  is_public boolean not null default true,
  created_by_user_id uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint status_incidents_title_not_blank check (length(btrim(title)) > 0),
  constraint status_incidents_resolved_date_valid check (
    resolved_at is null or resolved_at >= started_at
  )
);

create index status_incidents_public_idx
  on public.status_incidents (is_public, status, started_at desc)
  where deleted_at is null;

create table public.status_incident_updates (
  id uuid primary key default extensions.gen_random_uuid(),
  incident_id uuid not null references public.status_incidents (id) on delete cascade,
  service_id uuid null references public.status_services (id),
  status incident_status not null,
  message text not null,
  posted_by_user_id uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  constraint status_incident_updates_message_not_blank check (length(btrim(message)) > 0)
);

create index status_incident_updates_incident_time_idx
  on public.status_incident_updates (incident_id, created_at desc);

comment on table public.status_services is
  'A public-facing platform service and its current availability state.';
comment on table public.status_incidents is
  'A public or internal platform incident record.';
comment on table public.status_incident_updates is
  'An append-only update in an incident timeline.';
