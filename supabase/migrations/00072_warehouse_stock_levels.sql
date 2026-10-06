-- supabase/migrations/00072_warehouse_stock_levels.sql
-- Current stock snapshot for a product at a warehouse. The stock movement
-- ledger remains the audit source; this table is the fast operational view.

create table public.warehouse_stock_levels (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  warehouse_id uuid not null references public.warehouses (id),
  product_id uuid not null references public.products (id),
  quantity_on_hand numeric(18, 4) not null default 0,
  quantity_reserved numeric(18, 4) not null default 0,
  reorder_level numeric(18, 4) not null default 0,
  reorder_quantity numeric(18, 4) not null default 0,
  average_cost_amount numeric(18, 4) not null default 0,
  currency_code text not null default 'USD',
  last_counted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint warehouse_stock_levels_on_hand_non_negative check (quantity_on_hand >= 0),
  constraint warehouse_stock_levels_reserved_non_negative check (quantity_reserved >= 0),
  constraint warehouse_stock_levels_reserved_within_stock check (
    quantity_reserved <= quantity_on_hand
  ),
  constraint warehouse_stock_levels_reorder_level_non_negative check (reorder_level >= 0),
  constraint warehouse_stock_levels_reorder_quantity_non_negative check (reorder_quantity >= 0),
  constraint warehouse_stock_levels_average_cost_non_negative check (average_cost_amount >= 0)
);

create unique index warehouse_stock_levels_warehouse_product_key
  on public.warehouse_stock_levels (warehouse_id, product_id)
  where deleted_at is null;
create index warehouse_stock_levels_company_id_idx
  on public.warehouse_stock_levels (company_id)
  where deleted_at is null;
create index warehouse_stock_levels_low_stock_idx
  on public.warehouse_stock_levels (company_id, warehouse_id)
  where quantity_on_hand <= reorder_level and deleted_at is null;

comment on table public.warehouse_stock_levels is
  'The current stock snapshot for one product at one warehouse; stock_movements is the append-only audit ledger.';
