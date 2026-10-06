-- supabase/migrations/00078_purchase_order_line_items.sql
-- Product lines on a purchase order, including partial receiving counters.

create table public.purchase_order_line_items (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  purchase_order_id uuid not null references public.purchase_orders (id) on delete cascade,
  product_id uuid not null references public.products (id),
  description text not null,
  ordered_quantity numeric(18, 4) not null,
  received_quantity numeric(18, 4) not null default 0,
  unit_price_amount numeric(18, 4) not null default 0,
  tax_rate_percent numeric(7, 4) null,
  line_total_amount numeric(18, 4) not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint purchase_order_line_items_description_not_blank check (
    length(btrim(description)) > 0
  ),
  constraint purchase_order_line_items_ordered_positive check (ordered_quantity > 0),
  constraint purchase_order_line_items_received_valid check (
    received_quantity >= 0 and received_quantity <= ordered_quantity
  ),
  constraint purchase_order_line_items_unit_price_non_negative check (unit_price_amount >= 0),
  constraint purchase_order_line_items_tax_rate_valid check (
    tax_rate_percent is null or tax_rate_percent between 0 and 100
  ),
  constraint purchase_order_line_items_total_non_negative check (line_total_amount >= 0),
  constraint purchase_order_line_items_sort_order_non_negative check (sort_order >= 0)
);

create unique index purchase_order_line_items_order_product_key
  on public.purchase_order_line_items (purchase_order_id, product_id)
  where deleted_at is null;
create index purchase_order_line_items_company_id_idx
  on public.purchase_order_line_items (company_id)
  where deleted_at is null;
create index purchase_order_line_items_product_id_idx
  on public.purchase_order_line_items (product_id)
  where deleted_at is null;

comment on table public.purchase_order_line_items is
  'One product line on a purchase order, with a counter for quantities already received.';
