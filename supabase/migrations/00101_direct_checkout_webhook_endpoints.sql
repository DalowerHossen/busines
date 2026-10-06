-- supabase/migrations/00101_direct_checkout_webhook_endpoints.sql
-- Merchant callback endpoints for hosted/direct checkout payment updates.

create table public.direct_checkout_webhook_endpoints (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  api_key_pair_id uuid not null references public.direct_checkout_api_key_pairs (id) on delete cascade,
  callback_url text not null,
  event_types text[] not null default '{}',
  signing_secret_encrypted text not null,
  is_active boolean not null default true,
  last_delivered_at timestamptz null,
  last_error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint direct_checkout_webhook_endpoints_callback_url_not_blank check (
    length(btrim(callback_url)) > 0
  ),
  constraint direct_checkout_webhook_endpoints_secret_not_blank check (
    length(btrim(signing_secret_encrypted)) > 0
  )
);

create unique index direct_checkout_webhook_endpoints_pair_url_key
  on public.direct_checkout_webhook_endpoints (api_key_pair_id, lower(callback_url))
  where deleted_at is null;
create index direct_checkout_webhook_endpoints_company_id_idx
  on public.direct_checkout_webhook_endpoints (company_id)
  where deleted_at is null;
create index direct_checkout_webhook_endpoints_active_idx
  on public.direct_checkout_webhook_endpoints (company_id, is_active)
  where is_active = true and deleted_at is null;

comment on table public.direct_checkout_webhook_endpoints is
  'A tenant callback endpoint receiving signed hosted-checkout payment events.';
