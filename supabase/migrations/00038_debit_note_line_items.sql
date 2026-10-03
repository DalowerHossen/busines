-- supabase/migrations/00038_debit_note_line_items.sql
-- One line item on a debit note. product_id has no foreign key yet
-- (products arrives Phase 11).

create table public.debit_note_line_items (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  debit_note_id uuid not null references public.debit_notes (id),
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

create index debit_note_line_items_debit_note_id_idx
  on public.debit_note_line_items (debit_note_id);
create index debit_note_line_items_company_id_idx on public.debit_note_line_items (company_id);

comment on table public.debit_note_line_items is
  'One line item on a debit note. A debit note is immutable once issued, so these rows are never updated or soft-deleted after creation.';
