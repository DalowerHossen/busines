-- supabase/migrations/00094_ecommerce_connections.sql
-- A tenant's connected Shopify or WooCommerce store. Store credentials and
-- webhook secrets are encrypted before they are persisted.

create table public.ecommerce_connections (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  platform ecommerce_platform not null,
  store_name text not null,
  store_url text not null,
  external_store_id text null,
  connection_status ecommerce_connection_status not null default 'pending',
  credentials_encrypted text not null,
  webhook_secret_encrypted text null,
  settings jsonb not null default '{}'::jsonb,
  connected_by_user_id uuid not null references public.users (id),
  connected_at timestamptz null,
  last_synced_at timestamptz null,
  last_error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint ecommerce_connections_store_name_not_blank check (length(btrim(store_name)) > 0),
  constraint ecommerce_connections_store_url_not_blank check (length(btrim(store_url)) > 0),
  constraint ecommerce_connections_credentials_not_blank check (length(btrim(credentials_encrypted)) > 0),
  constraint ecommerce_connections_settings_object check (jsonb_typeof(settings) = 'object')
);

create unique index ecommerce_connections_company_platform_store_key
  on public.ecommerce_connections (company_id, platform, lower(store_url))
  where deleted_at is null;
create unique index ecommerce_connections_external_store_key
  on public.ecommerce_connections (platform, external_store_id)
  where external_store_id is not null and deleted_at is null;
create index ecommerce_connections_company_id_idx
  on public.ecommerce_connections (company_id)
  where deleted_at is null;
create index ecommerce_connections_status_idx
  on public.ecommerce_connections (company_id, connection_status)
  where deleted_at is null;

comment on table public.ecommerce_connections is
  'A tenant-owned Shopify or WooCommerce connection. Plaintext store credentials are never stored.';
