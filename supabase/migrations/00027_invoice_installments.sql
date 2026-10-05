-- supabase/migrations/00027_invoice_installments.sql
-- A single scheduled or recorded installment on an invoice that supports
-- partial/installment payment. amount_paid is updated as payments arrive
-- once the payments module (Phase 9) exists; this migration only defines
-- the shape.

create table public.invoice_installments (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  invoice_id uuid not null references public.invoices (id),
  due_date date not null,
  amount_due numeric(14, 2) not null,
  amount_paid numeric(14, 2) not null default 0,
  is_paid boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create index invoice_installments_invoice_id_idx
  on public.invoice_installments (invoice_id)
  where deleted_at is null;
create index invoice_installments_company_id_idx on public.invoice_installments (company_id);
create index invoice_installments_due_date_idx
  on public.invoice_installments (due_date)
  where is_paid = false and deleted_at is null;

comment on table public.invoice_installments is
  'A scheduled or recorded installment on an invoice supporting partial/installment payment.';
