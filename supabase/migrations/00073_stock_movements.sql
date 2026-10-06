-- supabase/migrations/00073_stock_movements.sql
-- Append-only inventory ledger. quantity_delta is positive for stock coming
-- in and negative for stock leaving; the before/after values make each entry
-- independently auditable and support later concurrency checks.

create type stock_movement_type as enum (
  'opening_balance',
  'purchase_receipt',
  'sale',
  'sale_return',
  'adjustment_increase',
  'adjustment_decrease',
  'transfer_in',
  'transfer_out',
  'damage',
  'waste',
  'bundle_assembly',
  'bundle_disassembly'
);

create table public.stock_movements (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  warehouse_id uuid not null references public.warehouses (id),
  product_id uuid not null references public.products (id),
  movement_type stock_movement_type not null,
  quantity_delta numeric(18, 4) not null,
  quantity_before numeric(18, 4) not null,
  quantity_after numeric(18, 4) not null,
  unit_cost_amount numeric(18, 4) null,
  currency_code text not null default 'USD',
  reference_type text null,
  reference_id uuid null,
  notes text null,
  performed_by_user_id uuid null references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint stock_movements_delta_non_zero check (quantity_delta <> 0),
  constraint stock_movements_quantity_before_non_negative check (quantity_before >= 0),
  constraint stock_movements_quantity_after_non_negative check (quantity_after >= 0),
  constraint stock_movements_unit_cost_non_negative check (
    unit_cost_amount is null or unit_cost_amount >= 0
  ),
  constraint stock_movements_quantity_math check (
    quantity_after = quantity_before + quantity_delta
  )
);

create index stock_movements_company_id_idx
  on public.stock_movements (company_id, created_at desc)
  where deleted_at is null;
create index stock_movements_warehouse_product_idx
  on public.stock_movements (warehouse_id, product_id, created_at desc)
  where deleted_at is null;
create index stock_movements_reference_idx
  on public.stock_movements (reference_type, reference_id)
  where reference_id is not null;

comment on table public.stock_movements is
  'Append-only stock movement ledger. Corrections are represented by compensating movements rather than destructive edits.';
