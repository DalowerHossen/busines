-- supabase/migrations/00034_recurring_invoice_template_line_items.sql
-- The line items copied onto every invoice a recurring_invoice_templates
-- row generates. product_id has no foreign key yet (products arrives
-- Phase 11).

create table public.recurring_invoice_template_line_items (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  recurring_invoice_template_id uuid not null references public.recurring_invoice_templates (id),
  product_id uuid null,
  description text not null,
  quantity numeric(14, 4) not null default 1,
  unit_price_amount numeric(14, 2) not null default 0,
  tax_rate_percent numeric(5, 2) null,
  discount_percent numeric(5, 2) null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create index recurring_invoice_template_line_items_template_id_idx
  on public.recurring_invoice_template_line_items (recurring_invoice_template_id)
  where deleted_at is null;
create index recurring_invoice_template_line_items_company_id_idx
  on public.recurring_invoice_template_line_items (company_id);

comment on table public.recurring_invoice_template_line_items is
  'Line items copied onto every invoice a recurring_invoice_templates row generates.';
