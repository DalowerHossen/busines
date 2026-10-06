-- supabase/migrations/00097_ecommerce_order_line_items.sql
-- Individual external order lines. Product mapping is optional because an
-- order may arrive before the owner completes catalogue mapping.

create table public.ecommerce_order_line_items (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  order_id uuid not null references public.ecommerce_orders (id) on delete cascade,
  mapping_id uuid null references public.ecommerce_product_mappings (id),
  product_id uuid null references public.products (id),
  external_line_id text not null,
  external_product_id text null,
  external_variant_id text null,
  sku text null,
  description text not null,
  quantity numeric(18, 4) not null,
  unit_price_amount numeric(18, 4) not null default 0,
  discount_amount numeric(18, 4) not null default 0,
  tax_amount numeric(18, 4) not null default 0,
  line_total_amount numeric(18, 4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint ecommerce_order_line_items_external_id_not_blank check (
    length(btrim(external_line_id)) > 0
  ),
  constraint ecommerce_order_line_items_description_not_blank check (
    length(btrim(description)) > 0
  ),
  constraint ecommerce_order_line_items_quantity_positive check (quantity > 0),
  constraint ecommerce_order_line_items_amounts_non_negative check (
    unit_price_amount >= 0 and discount_amount >= 0 and tax_amount >= 0 and line_total_amount >= 0
  )
);

create unique index ecommerce_order_line_items_order_external_id_key
  on public.ecommerce_order_line_items (order_id, external_line_id)
  where deleted_at is null;
create index ecommerce_order_line_items_company_id_idx
  on public.ecommerce_order_line_items (company_id)
  where deleted_at is null;
create index ecommerce_order_line_items_mapping_id_idx
  on public.ecommerce_order_line_items (mapping_id)
  where mapping_id is not null and deleted_at is null;
create index ecommerce_order_line_items_product_id_idx
  on public.ecommerce_order_line_items (product_id)
  where product_id is not null and deleted_at is null;

comment on table public.ecommerce_order_line_items is
  'One imported external order line, optionally resolved to a platform mapping and product.';
