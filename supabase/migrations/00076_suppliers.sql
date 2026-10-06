-- supabase/migrations/00076_suppliers.sql
-- Supplier records used by purchasing and accounts payable. Suppliers are
-- tenant-scoped and do not hold platform accounts.

create table public.suppliers (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  name text not null,
  supplier_code text null,
  email citext null,
  phone text null,
  tax_id text null,
  address_line1 text null,
  address_line2 text null,
  city text null,
  state text null,
  postal_code text null,
  country_code text null,
  default_currency_code text not null default 'USD',
  payment_terms_days integer not null default 0,
  notes text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint suppliers_name_not_blank check (length(btrim(name)) > 0),
  constraint suppliers_code_not_blank check (
    supplier_code is null or length(btrim(supplier_code)) > 0
  ),
  constraint suppliers_payment_terms_non_negative check (payment_terms_days >= 0)
);

create unique index suppliers_company_code_key
  on public.suppliers (company_id, lower(supplier_code))
  where supplier_code is not null and deleted_at is null;
create index suppliers_company_id_idx
  on public.suppliers (company_id)
  where deleted_at is null;
create index suppliers_name_search_idx
  on public.suppliers using gin (name extensions.gin_trgm_ops)
  where deleted_at is null;

comment on table public.suppliers is
  'A tenant-scoped supplier record for purchasing and accounts payable.';
