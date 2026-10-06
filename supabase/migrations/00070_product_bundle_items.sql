-- supabase/migrations/00070_product_bundle_items.sql
-- Component products and services included in a product bundle.

create table public.product_bundle_items (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  bundle_id uuid not null references public.product_bundles (id) on delete cascade,
  product_id uuid not null references public.products (id),
  quantity numeric(18, 4) not null default 1,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint product_bundle_items_quantity_positive check (quantity > 0),
  constraint product_bundle_items_sort_order_non_negative check (sort_order >= 0)
);

create unique index product_bundle_items_bundle_product_key
  on public.product_bundle_items (bundle_id, product_id)
  where deleted_at is null;
create index product_bundle_items_company_id_idx
  on public.product_bundle_items (company_id)
  where deleted_at is null;
create index product_bundle_items_product_id_idx
  on public.product_bundle_items (product_id)
  where deleted_at is null;

comment on table public.product_bundle_items is
  'One product or service component and its quantity within a product bundle.';
