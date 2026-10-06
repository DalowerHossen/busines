-- supabase/migrations/00116_reseller_profiles.sql
-- Platform-level white-label reseller profile. Tenant data access is not
-- implied by this row and is enforced separately by reseller_sub_tenants and
-- later RLS policies.

create table public.reseller_profiles (
  id uuid primary key default extensions.gen_random_uuid(),
  reseller_user_id uuid not null references public.users (id),
  status reseller_status not null default 'pending',
  business_name text not null,
  logo_provider_file_id text null,
  favicon_provider_file_id text null,
  custom_domain text null,
  revenue_share_percent numeric(7, 4) not null default 0,
  pricing_config jsonb not null default '{}'::jsonb,
  approved_by_user_id uuid null references public.users (id),
  approved_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint reseller_profiles_business_name_not_blank check (length(btrim(business_name)) > 0),
  constraint reseller_profiles_revenue_share_valid check (revenue_share_percent between 0 and 100),
  constraint reseller_profiles_pricing_config_object check (jsonb_typeof(pricing_config) = 'object')
);

create unique index reseller_profiles_user_key
  on public.reseller_profiles (reseller_user_id)
  where deleted_at is null;
create unique index reseller_profiles_custom_domain_key
  on public.reseller_profiles (lower(custom_domain))
  where custom_domain is not null and deleted_at is null;
create index reseller_profiles_status_idx
  on public.reseller_profiles (status)
  where deleted_at is null;

comment on table public.reseller_profiles is
  'A white-label reseller profile with branding, domain, pricing, and revenue-share settings.';
