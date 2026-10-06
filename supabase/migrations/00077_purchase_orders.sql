-- supabase/migrations/00077_purchase_orders.sql
-- Purchase order header. Line items are stored separately so receiving can
-- track each product independently and partially receive an order.

create type purchase_order_status as enum (
  'draft',
  'sent',
  'partially_received',
  'received',
  'cancelled'
);

create table public.purchase_orders (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  supplier_id uuid not null references public.suppliers (id),
  destination_warehouse_id uuid not null references public.warehouses (id),
  purchase_order_number text not null,
  status purchase_order_status not null default 'draft',
  order_date date not null default current_date,
  expected_date date null,
  currency_code text not null default 'USD',
  subtotal_amount numeric(18, 4) not null default 0,
  tax_total_amount numeric(18, 4) not null default 0,
  total_amount numeric(18, 4) not null default 0,
  notes text null,
  sent_at timestamptz null,
  received_at timestamptz null,
  created_by_user_id uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint purchase_orders_number_not_blank check (
    length(btrim(purchase_order_number)) > 0
  ),
  constraint purchase_orders_amounts_non_negative check (
    subtotal_amount >= 0 and tax_total_amount >= 0 and total_amount >= 0
  ),
  constraint purchase_orders_total_at_least_subtotal check (
    total_amount >= subtotal_amount
  ),
  constraint purchase_orders_expected_date_valid check (
    expected_date is null or expected_date >= order_date
  ),
  constraint purchase_orders_received_date_valid check (
    received_at is null or sent_at is null or received_at >= sent_at
  )
);

create unique index purchase_orders_company_number_key
  on public.purchase_orders (company_id, purchase_order_number)
  where deleted_at is null;
create index purchase_orders_company_id_idx
  on public.purchase_orders (company_id)
  where deleted_at is null;
create index purchase_orders_supplier_id_idx
  on public.purchase_orders (supplier_id)
  where deleted_at is null;
create index purchase_orders_warehouse_id_idx
  on public.purchase_orders (destination_warehouse_id)
  where deleted_at is null;
create index purchase_orders_status_idx
  on public.purchase_orders (company_id, status)
  where deleted_at is null;

comment on table public.purchase_orders is
  'A tenant-scoped purchase order addressed to a supplier and received into a destination warehouse.';
