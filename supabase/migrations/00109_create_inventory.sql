-- supabase/migrations/00109_create_inventory.sql
-- Stock: where goods are kept, how much is there, and every movement.
--
-- The movement table is the truth and the level table is the cache. Movements
-- are never edited or deleted, so the quantity on hand can always be proved
-- from history.

create table public.warehouses (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,

  name text not null,
  code text,
  address_line1 text,
  address_line2 text,
  city text,
  state_region text,
  postal_code text,
  country_code char(2),

  contact_name text,
  contact_phone text,

  is_default boolean not null default false,
  is_active boolean not null default true,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint warehouses_name_check
    check (length(btrim(name)) between 2 and 80),
  constraint warehouses_code_check
    check (code is null or code ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,19}$'),
  constraint warehouses_country_check
    check (country_code is null or country_code ~ '^[A-Z]{2}$')
);

comment on table public.warehouses is
  'A place where stock is held, from a shop floor to a third party depot.';

create unique index warehouses_code_key
  on public.warehouses (company_id, code)
  where code is not null and deleted_at is null;

create unique index warehouses_default_key
  on public.warehouses (company_id)
  where is_default and deleted_at is null;

create index warehouses_company_idx
  on public.warehouses (company_id)
  where deleted_at is null;

-- A delivery lands somewhere, so the receipt now says which warehouse.
alter table public.purchase_receipts
  add column if not exists warehouse_id uuid;

comment on column public.purchase_receipts.warehouse_id is
  'The warehouse a delivery was booked into, used by the stock movements.';

-- -----------------------------------------------------------------------------
-- What is on hand
-- -----------------------------------------------------------------------------

create table public.stock_levels (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  product_id uuid not null,
  warehouse_id uuid not null,

  quantity_on_hand numeric(14, 3) not null default 0,
  -- Promised to an issued order but not yet shipped.
  quantity_reserved numeric(14, 3) not null default 0,
  quantity_available numeric(14, 3) not null
    generated always as (quantity_on_hand - quantity_reserved) stored,
  quantity_incoming numeric(14, 3) not null default 0,

  -- Weighted average cost, recalculated on every purchase.
  average_cost numeric(18, 4) not null default 0,
  stock_value numeric(18, 4) not null default 0,

  reorder_point numeric(14, 3),
  reorder_quantity numeric(14, 3),
  bin_location text,
  last_movement_at timestamptz,
  last_counted_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint stock_levels_reserved_check
    check (quantity_reserved >= 0 and quantity_incoming >= 0),
  constraint stock_levels_cost_check
    check (average_cost >= 0),
  constraint stock_levels_reorder_check
    check ((reorder_point is null or reorder_point >= 0)
           and (reorder_quantity is null or reorder_quantity > 0))
);

comment on table public.stock_levels is
  'The cached quantity and value of one product in one warehouse.';

create unique index stock_levels_product_key
  on public.stock_levels (product_id, warehouse_id);

create index stock_levels_company_idx
  on public.stock_levels (company_id, product_id);

-- The reorder report reads this directly.
create index stock_levels_low_idx
  on public.stock_levels (company_id)
  where reorder_point is not null;

-- -----------------------------------------------------------------------------
-- Every movement, forever
-- -----------------------------------------------------------------------------

create table public.stock_movements (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  product_id uuid not null,
  warehouse_id uuid not null,

  movement_type public.stock_movement_type not null,
  -- Signed: positive adds to stock, negative takes it away.
  quantity numeric(14, 3) not null,
  unit_cost numeric(18, 4) not null default 0,
  total_cost numeric(18, 4) not null default 0,
  quantity_after numeric(14, 3) not null default 0,

  movement_date date not null default current_date,
  reference_type text,
  reference_id uuid,
  reference_label text,
  notes text,

  -- The transfer that this movement is one half of.
  transfer_group_id uuid,
  journal_entry_id uuid,

  created_at timestamptz not null default now(),
  created_by uuid,

  constraint stock_movements_quantity_check
    check (quantity <> 0),
  constraint stock_movements_cost_check
    check (unit_cost >= 0 and total_cost >= 0),
  constraint stock_movements_reference_check
    check (reference_type is null
           or reference_type in ('invoice', 'credit_note', 'purchase_receipt',
                                 'adjustment', 'transfer', 'opening_balance',
                                 'stock_count'))
);

comment on table public.stock_movements is
  'The permanent history of stock in and out, which the levels are derived from.';

create index stock_movements_product_idx
  on public.stock_movements (product_id, movement_date desc);

create index stock_movements_warehouse_idx
  on public.stock_movements (warehouse_id, movement_date desc);

create index stock_movements_company_idx
  on public.stock_movements (company_id, created_at desc);

create index stock_movements_reference_idx
  on public.stock_movements (reference_type, reference_id)
  where reference_id is not null;

create index stock_movements_transfer_idx
  on public.stock_movements (transfer_group_id)
  where transfer_group_id is not null;

-- -----------------------------------------------------------------------------
-- Physical counts
-- -----------------------------------------------------------------------------

create table public.stock_counts (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  warehouse_id uuid not null,

  reference text not null,
  status text not null default 'in_progress',
  counted_on date not null default current_date,
  notes text,

  line_count integer not null default 0,
  discrepancy_value numeric(18, 4) not null default 0,

  completed_at timestamptz,
  completed_by uuid,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint stock_counts_reference_check
    check (reference ~ '^[A-Za-z0-9][A-Za-z0-9._/-]{1,31}$'),
  constraint stock_counts_status_check
    check (status in ('in_progress', 'completed', 'cancelled')),
  constraint stock_counts_completed_check
    check (status <> 'completed' or completed_at is not null)
);

comment on table public.stock_counts is
  'A physical stock take, which ends in adjustment movements.';

create unique index stock_counts_reference_key
  on public.stock_counts (company_id, reference)
  where deleted_at is null;

create table public.stock_count_items (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  stock_count_id uuid not null,
  product_id uuid not null,

  expected_quantity numeric(14, 3) not null default 0,
  counted_quantity numeric(14, 3) not null default 0,
  difference_quantity numeric(14, 3) not null
    generated always as (counted_quantity - expected_quantity) stored,
  unit_cost numeric(18, 4) not null default 0,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint stock_count_items_quantity_check
    check (counted_quantity >= 0 and unit_cost >= 0)
);

comment on table public.stock_count_items is
  'One product on a stock take, expected against actually counted.';

create unique index stock_count_items_product_key
  on public.stock_count_items (stock_count_id, product_id);
