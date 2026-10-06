-- supabase/migrations/00081_communication_channels.sql
-- Tenant-owned channel connections for email, WhatsApp, SMS, Telegram, and
-- Viber. Secrets are encrypted strings; plaintext provider credentials never
-- belong in this table or in client-accessible data.

create table public.communication_channels (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  channel communication_channel not null,
  display_name text not null,
  connection_status channel_connection_status not null default 'pending',
  provider_key text not null,
  provider_account_id text null,
  sender_address text null,
  sender_display_name text null,
  credentials_encrypted text null,
  webhook_secret_encrypted text null,
  settings jsonb not null default '{}'::jsonb,
  is_default boolean not null default false,
  last_connected_at timestamptz null,
  last_error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint communication_channels_not_in_app check (channel <> 'in_app'),
  constraint communication_channels_display_name_not_blank check (
    length(btrim(display_name)) > 0
  ),
  constraint communication_channels_provider_key_not_blank check (
    length(btrim(provider_key)) > 0
  ),
  constraint communication_channels_settings_object check (jsonb_typeof(settings) = 'object')
);

create unique index communication_channels_company_channel_sender_key
  on public.communication_channels (company_id, channel, lower(coalesce(sender_address, '')))
  where deleted_at is null;
create unique index communication_channels_one_default_key
  on public.communication_channels (company_id, channel)
  where is_default = true and deleted_at is null;
create index communication_channels_company_id_idx
  on public.communication_channels (company_id)
  where deleted_at is null;
create index communication_channels_status_idx
  on public.communication_channels (company_id, connection_status)
  where deleted_at is null;

comment on table public.communication_channels is
  'A tenant communication-channel connection. Provider credentials and webhook secrets are encrypted before storage.';
