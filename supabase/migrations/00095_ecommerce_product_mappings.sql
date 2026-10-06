-- supabase/migrations/00095_ecommerce_product_mappings.sql
-- Maps an external store product or variant to a platform product so orders
-- can be invoiced and inventory can be updated deterministically.

create table public.ecommerce_product_mappings (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  connection_id uuid not null references public.ecommerce_connections (id) on delete cascade,
  product_id uuid null references public.products (id),
  external_product_id text not null,
  external_variant_id text null,
  external_sku text null,
  external_name text not null,
  is_active boolean not null default true,
  last_synced_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint ecommerce_product_mappings_external_product_not_blank check (
    length(btrim(external_product_id)) > 0
  ),
  constraint ecommerce_product_mappings_external_name_not_blank check (
    length(btrim(external_name)) > 0
  )
);

create unique index ecommerce_product_mappings_external_variant_key
  on public.ecommerce_product_mappings (
    connection_id,
    external_product_id,
    coalesce(external_variant_id, '')
  )
  where deleted_at is null;
create unique index ecommerce_product_mappings_connection_product_key
  on public.ecommerce_product_mappings (connection_id, product_id)
  where product_id is not null and deleted_at is null;
create index ecommerce_product_mappings_company_id_idx
  on public.ecommerce_product_mappings (company_id)
  where deleted_at is null;
create index ecommerce_product_mappings_product_id_idx
  on public.ecommerce_product_mappings (product_id)
  where product_id is not null and deleted_at is null;

comment on table public.ecommerce_product_mappings is
  'A mapping between an external store product or variant and an optional tenant product.';
