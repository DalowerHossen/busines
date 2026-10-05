-- supabase/migrations/00024_invoice_line_items.sql
-- One line item on an invoice. product_id has NO foreign key yet: the
-- products table does not exist until Phase 11, so a free-typed
-- description-only line item (product_id null) must already work today.
-- Amount columns intentionally omit a per-line currency_code: every line
-- item always shares its parent invoice's currency, which remains the
-- single source of truth.

create table public.invoice_line_items (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  invoice_id uuid not null references public.invoices (id),
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

create index invoice_line_items_invoice_id_idx
  on public.invoice_line_items (invoice_id)
  where deleted_at is null;
create index invoice_line_items_company_id_idx on public.invoice_line_items (company_id);
create index invoice_line_items_product_id_idx
  on public.invoice_line_items (product_id)
  where product_id is not null;

comment on table public.invoice_line_items is
  'One line item on an invoice. Inherits its currency from the parent invoice; product_id references products(id) once Phase 11 creates that table.';
