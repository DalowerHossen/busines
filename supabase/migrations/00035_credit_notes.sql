-- supabase/migrations/00035_credit_notes.sql
-- A credit note issued against a previously sent invoice (for example a
-- refund or billing correction that reduces what the client owes). There
-- is no status column: a credit note is final the moment it is issued,
-- matching the lean CreditNote TS shape.

create table public.credit_notes (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  invoice_id uuid not null references public.invoices (id),
  credit_note_number text not null,
  reason text not null,
  currency_code text not null default 'USD',
  total_amount numeric(14, 2) not null default 0,
  issue_date date not null default current_date,
  created_by_user_id uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create unique index credit_notes_company_credit_note_number_key
  on public.credit_notes (company_id, credit_note_number)
  where deleted_at is null;
create index credit_notes_company_id_idx on public.credit_notes (company_id) where deleted_at is null;
create index credit_notes_invoice_id_idx on public.credit_notes (invoice_id);

comment on table public.credit_notes is
  'A credit note issued against a previously sent invoice, reducing what the client owes. Final once issued -- no status column.';
