-- supabase/migrations/00068_products.sql
-- Sellable products and services. A service can never be inventory-tracked;
-- physical products may opt into stock tracking through track_inventory.

create type product_type as enum (
  'product',
  'service'
);

create table public.products (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  type product_type not null default 'product',
  name text not null,
  sku text null,
  description text null,
  currency_code text not null default 'USD',
  unit_price_amount numeric(18, 4) not null default 0,
  default_tax_rate_percent numeric(7, 4) null,
  category_id uuid null references public.product_categories (id) on delete set null,
  track_inventory boolean not null default false,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint products_name_not_blank check (length(btrim(name)) > 0),
  constraint products_sku_not_blank check (sku is null or length(btrim(sku)) > 0),
  constraint products_unit_price_non_negative check (unit_price_amount >= 0),
  constraint products_tax_rate_valid check (
    default_tax_rate_percent is null or default_tax_rate_percent between 0 and 100
  ),
  constraint products_service_not_inventory_tracked check (
    type <> 'service' or track_inventory = false
  )
);

create unique index products_company_sku_key
  on public.products (company_id, lower(sku))
  where sku is not null and deleted_at is null;
create index products_company_id_idx
  on public.products (company_id)
  where deleted_at is null;
create index products_category_id_idx
  on public.products (category_id)
  where category_id is not null and deleted_at is null;
create index products_catalog_search_idx
  on public.products using gin (name extensions.gin_trgm_ops)
  where deleted_at is null;

comment on table public.products is
  'A tenant-scoped product or service available for invoices, estimates, purchasing, or inventory.';
