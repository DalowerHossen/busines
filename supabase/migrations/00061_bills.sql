-- supabase/migrations/00061_bills.sql
-- A supplier bill (P6.4/P6.5), the accounts-payable counterpart of an
-- invoice. supplier_id has NO foreign key yet: the suppliers table does
-- not exist until Phase 11, the same forward-reference pattern used
-- repeatedly in earlier phases (e.g. invoices.template_id in Phase 7).

create table public.bills (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  supplier_id uuid null,
  bill_number text not null,
  status bill_status not null default 'draft',
  bill_date date not null default current_date,
  due_date date not null,
  currency_code text not null default 'USD',
  subtotal_amount numeric(14, 2) not null default 0,
  tax_total_amount numeric(14, 2) not null default 0,
  total_amount numeric(14, 2) not null default 0,
  amount_paid numeric(14, 2) not null default 0,
  amount_due numeric(14, 2) not null default 0,
  notes text null,
  created_by_user_id uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create unique index bills_company_bill_number_key
  on public.bills (company_id, bill_number)
  where deleted_at is null;
create index bills_company_id_idx on public.bills (company_id) where deleted_at is null;
create index bills_supplier_id_idx on public.bills (supplier_id) where supplier_id is not null;
create index bills_status_idx on public.bills (company_id, status) where deleted_at is null;
create index bills_due_date_idx
  on public.bills (due_date)
  where status not in ('paid', 'void') and deleted_at is null;

comment on table public.bills is
  'A supplier bill (accounts payable). supplier_id references suppliers(id) once Phase 11 creates that table.';
