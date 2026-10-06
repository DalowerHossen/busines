-- supabase/migrations/00074_stock_transfers.sql
-- A transfer of stock between two warehouses belonging to the same company.

create type stock_transfer_status as enum (
  'draft',
  'in_transit',
  'received',
  'cancelled'
);

create table public.stock_transfers (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  transfer_number text not null,
  source_warehouse_id uuid not null references public.warehouses (id),
  destination_warehouse_id uuid not null references public.warehouses (id),
  status stock_transfer_status not null default 'draft',
  requested_at timestamptz not null default now(),
  shipped_at timestamptz null,
  received_at timestamptz null,
  requested_by_user_id uuid not null references public.users (id),
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint stock_transfers_number_not_blank check (length(btrim(transfer_number)) > 0),
  constraint stock_transfers_distinct_warehouses check (
    source_warehouse_id <> destination_warehouse_id
  ),
  constraint stock_transfers_received_after_shipped check (
    received_at is null or shipped_at is null or received_at >= shipped_at
  )
);

create unique index stock_transfers_company_number_key
  on public.stock_transfers (company_id, transfer_number)
  where deleted_at is null;
create index stock_transfers_company_id_idx
  on public.stock_transfers (company_id, created_at desc)
  where deleted_at is null;
create index stock_transfers_source_warehouse_idx
  on public.stock_transfers (source_warehouse_id)
  where deleted_at is null;
create index stock_transfers_destination_warehouse_idx
  on public.stock_transfers (destination_warehouse_id)
  where deleted_at is null;
create index stock_transfers_status_idx
  on public.stock_transfers (company_id, status)
  where deleted_at is null;

comment on table public.stock_transfers is
  'A tenant-scoped movement of stock from one warehouse to another.';
