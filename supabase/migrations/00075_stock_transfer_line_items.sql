-- supabase/migrations/00075_stock_transfer_line_items.sql
-- Products and quantities included in an inter-warehouse stock transfer.

create table public.stock_transfer_line_items (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  transfer_id uuid not null references public.stock_transfers (id) on delete cascade,
  product_id uuid not null references public.products (id),
  requested_quantity numeric(18, 4) not null,
  shipped_quantity numeric(18, 4) not null default 0,
  received_quantity numeric(18, 4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint stock_transfer_line_items_requested_positive check (requested_quantity > 0),
  constraint stock_transfer_line_items_shipped_valid check (
    shipped_quantity >= 0 and shipped_quantity <= requested_quantity
  ),
  constraint stock_transfer_line_items_received_valid check (
    received_quantity >= 0 and received_quantity <= shipped_quantity
  )
);

create unique index stock_transfer_line_items_transfer_product_key
  on public.stock_transfer_line_items (transfer_id, product_id)
  where deleted_at is null;
create index stock_transfer_line_items_company_id_idx
  on public.stock_transfer_line_items (company_id)
  where deleted_at is null;
create index stock_transfer_line_items_product_id_idx
  on public.stock_transfer_line_items (product_id)
  where deleted_at is null;

comment on table public.stock_transfer_line_items is
  'One product quantity line within an inter-warehouse stock transfer.';
