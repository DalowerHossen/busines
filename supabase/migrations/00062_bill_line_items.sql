-- supabase/migrations/00062_bill_line_items.sql
-- One line item on a supplier bill. product_id has no foreign key yet
-- (products arrives Phase 11).

create table public.bill_line_items (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  bill_id uuid not null references public.bills (id),
  product_id uuid null,
  description text not null,
  quantity numeric(14, 4) not null default 1,
  unit_price_amount numeric(14, 2) not null default 0,
  line_total_amount numeric(14, 2) not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create index bill_line_items_bill_id_idx on public.bill_line_items (bill_id) where deleted_at is null;
create index bill_line_items_company_id_idx on public.bill_line_items (company_id);

comment on table public.bill_line_items is
  'One line item on a supplier bill. Inherits its currency from the parent bill; product_id references products(id) once Phase 11 creates that table.';
