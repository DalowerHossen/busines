-- supabase/migrations/00117_reseller_sub_tenants.sql
-- Links a reseller to a company created under its white-label program. The
-- reseller can see billing metadata only; invoices and client data remain
-- protected by the later tenant-isolation policies.

create table public.reseller_sub_tenants (
  id uuid primary key default extensions.gen_random_uuid(),
  reseller_user_id uuid not null references public.users (id),
  company_id uuid not null references public.companies (id),
  status reseller_status not null default 'pending',
  revenue_share_percent numeric(7, 4) null,
  joined_at timestamptz null,
  suspended_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint reseller_sub_tenants_revenue_share_valid check (
    revenue_share_percent is null or revenue_share_percent between 0 and 100
  ),
  constraint reseller_sub_tenants_dates_valid check (
    suspended_at is null or joined_at is null or suspended_at >= joined_at
  )
);

create unique index reseller_sub_tenants_reseller_company_key
  on public.reseller_sub_tenants (reseller_user_id, company_id)
  where deleted_at is null;
create index reseller_sub_tenants_reseller_status_idx
  on public.reseller_sub_tenants (reseller_user_id, status)
  where deleted_at is null;
create index reseller_sub_tenants_company_idx
  on public.reseller_sub_tenants (company_id)
  where deleted_at is null;

comment on table public.reseller_sub_tenants is
  'A reseller-to-tenant linkage. It is a billing-metadata relationship, not permission to read tenant business records.';
