-- supabase/migrations/00069_product_bundles.sql
-- A bundle is a sellable catalogue entry composed of one or more products
-- or services. Its component rows are stored in product_bundle_items.

create table public.product_bundles (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  name text not null,
  description text null,
  currency_code text not null default 'USD',
  bundle_price_amount numeric(18, 4) not null default 0,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint product_bundles_name_not_blank check (length(btrim(name)) > 0),
  constraint product_bundles_price_non_negative check (bundle_price_amount >= 0)
);

create unique index product_bundles_company_name_key
  on public.product_bundles (company_id, lower(name))
  where deleted_at is null;
create index product_bundles_company_id_idx
  on public.product_bundles (company_id)
  where deleted_at is null;

comment on table public.product_bundles is
  'A tenant-scoped fixed-price bundle of products and services.';
