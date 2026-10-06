-- supabase/migrations/00086_client_communication_preferences.sql
-- Per-client channel preferences and contact addresses. Client accounts do
-- not exist; these records support consent-aware routing to a client's
-- email address, phone number, Telegram handle, or Viber address.

create table public.client_communication_preferences (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  client_id uuid not null references public.clients (id) on delete cascade,
  channel communication_channel not null,
  address text not null,
  is_enabled boolean not null default true,
  is_primary boolean not null default false,
  consent_source text null,
  opted_in_at timestamptz null,
  opted_out_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint client_communication_preferences_channel_valid check (channel <> 'in_app'),
  constraint client_communication_preferences_address_not_blank check (length(btrim(address)) > 0),
  constraint client_communication_preferences_opt_out_after_opt_in check (
    opted_out_at is null or opted_in_at is null or opted_out_at >= opted_in_at
  )
);

create unique index client_communication_preferences_client_channel_key
  on public.client_communication_preferences (client_id, channel)
  where deleted_at is null;
create unique index client_communication_preferences_one_primary_key
  on public.client_communication_preferences (client_id)
  where is_primary = true and deleted_at is null;
create index client_communication_preferences_company_id_idx
  on public.client_communication_preferences (company_id)
  where deleted_at is null;
create index client_communication_preferences_client_id_idx
  on public.client_communication_preferences (client_id)
  where deleted_at is null;

comment on table public.client_communication_preferences is
  'A client communication address, opt-in state, and preferred route for tenant-owned messaging.';
