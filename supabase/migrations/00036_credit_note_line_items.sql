-- supabase/migrations/00036_credit_note_line_items.sql
-- One line item on a credit note. product_id has no foreign key yet
-- (products arrives Phase 11).

create table public.credit_note_line_items (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  credit_note_id uuid not null references public.credit_notes (id),
  product_id uuid null,
  description text not null,
  quantity numeric(14, 4) not null default 1,
  unit_price_amount numeric(14, 2) not null default 0,
  tax_rate_percent numeric(5, 2) null,
  discount_percent numeric(5, 2) null,
  line_total_amount numeric(14, 2) not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index credit_note_line_items_credit_note_id_idx
  on public.credit_note_line_items (credit_note_id);
create index credit_note_line_items_company_id_idx on public.credit_note_line_items (company_id);

comment on table public.credit_note_line_items is
  'One line item on a credit note. A credit note is immutable once issued, so these rows are never updated or soft-deleted after creation.';
