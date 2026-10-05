-- supabase/migrations/00037_debit_notes.sql
-- A debit note issued against a previously sent invoice (for example an
-- additional charge after the original invoice was issued). There is no
-- status column: a debit note is final the moment it is issued, matching
-- the lean DebitNote TS shape.

create table public.debit_notes (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  invoice_id uuid not null references public.invoices (id),
  debit_note_number text not null,
  reason text not null,
  currency_code text not null default 'USD',
  total_amount numeric(14, 2) not null default 0,
  issue_date date not null default current_date,
  created_by_user_id uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create unique index debit_notes_company_debit_note_number_key
  on public.debit_notes (company_id, debit_note_number)
  where deleted_at is null;
create index debit_notes_company_id_idx on public.debit_notes (company_id) where deleted_at is null;
create index debit_notes_invoice_id_idx on public.debit_notes (invoice_id);

comment on table public.debit_notes is
  'A debit note issued against a previously sent invoice, adding an additional charge. Final once issued -- no status column.';
