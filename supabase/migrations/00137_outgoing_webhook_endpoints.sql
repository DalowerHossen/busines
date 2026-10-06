-- supabase/migrations/00137_outgoing_webhook_endpoints.sql
-- Tenant webhook subscriptions with encrypted HMAC signing secrets.

create type outgoing_webhook_status as enum (
  'active',
  'paused',
  'disabled'
);

create table public.outgoing_webhook_endpoints (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  name text not null,
  endpoint_url text not null,
  signing_secret_encrypted text not null,
  subscribed_events text[] not null default '{}',
  status outgoing_webhook_status not null default 'active',
  failure_count integer not null default 0,
  last_delivered_at timestamptz null,
  last_failure_at timestamptz null,
  last_error text null,
  created_by_user_id uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint outgoing_webhook_endpoints_name_not_blank check (length(btrim(name)) > 0),
  constraint outgoing_webhook_endpoints_url_not_blank check (length(btrim(endpoint_url)) > 0),
  constraint outgoing_webhook_endpoints_secret_not_blank check (
    length(btrim(signing_secret_encrypted)) > 0
  ),
  constraint outgoing_webhook_endpoints_failure_count_non_negative check (failure_count >= 0)
);

create unique index outgoing_webhook_endpoints_company_url_key
  on public.outgoing_webhook_endpoints (company_id, lower(endpoint_url))
  where deleted_at is null;
create index outgoing_webhook_endpoints_active_idx
  on public.outgoing_webhook_endpoints (company_id, status)
  where status = 'active' and deleted_at is null;

comment on table public.outgoing_webhook_endpoints is
  'A tenant endpoint receiving signed event notifications with retryable delivery.';
