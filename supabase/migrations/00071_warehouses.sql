-- supabase/migrations/00071_warehouses.sql
-- Tenant-owned warehouse or stock location. A company may operate multiple
-- warehouses, with at most one active default warehouse.

create table public.warehouses (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  name text not null,
  code text not null,
  address_line1 text null,
  address_line2 text null,
  city text null,
  state text null,
  postal_code text null,
  country_code text null,
  contact_name text null,
  contact_phone text null,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint warehouses_name_not_blank check (length(btrim(name)) > 0),
  constraint warehouses_code_not_blank check (length(btrim(code)) > 0)
);

create unique index warehouses_company_code_key
  on public.warehouses (company_id, lower(code))
  where deleted_at is null;
create unique index warehouses_one_default_per_company_key
  on public.warehouses (company_id)
  where is_default = true and is_active = true and deleted_at is null;
create index warehouses_company_id_idx
  on public.warehouses (company_id)
  where deleted_at is null;

comment on table public.warehouses is
  'A tenant-scoped warehouse or physical stock location.';
