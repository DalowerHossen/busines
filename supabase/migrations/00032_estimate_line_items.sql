-- supabase/migrations/00032_estimate_line_items.sql
-- One line item on an estimate, mirroring invoice_line_items. product_id
-- has no foreign key yet (products arrives Phase 11).

create table public.estimate_line_items (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  estimate_id uuid not null references public.estimates (id),
  product_id uuid null,
  description text not null,
  quantity numeric(14, 4) not null default 1,
  unit_price_amount numeric(14, 2) not null default 0,
  tax_rate_percent numeric(5, 2) null,
  discount_percent numeric(5, 2) null,
  line_total_amount numeric(14, 2) not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create index estimate_line_items_estimate_id_idx
  on public.estimate_line_items (estimate_id)
  where deleted_at is null;
create index estimate_line_items_company_id_idx on public.estimate_line_items (company_id);
create index estimate_line_items_product_id_idx
  on public.estimate_line_items (product_id)
  where product_id is not null;

comment on table public.estimate_line_items is
  'One line item on an estimate. Inherits its currency from the parent estimate; product_id references products(id) once Phase 11 creates that table.';
