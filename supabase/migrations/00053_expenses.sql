-- supabase/migrations/00053_expenses.sql
-- A single recorded business expense. rebill_invoice_id is set once a
-- billable expense (AA7.8 reimbursable expense rebilling) has actually
-- been added to a client invoice; receipt_provider_file_id only ever
-- stores a reference, never the binary receipt image itself (that lives
-- in the configured storage provider).

create table public.expenses (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  category_id uuid null references public.expense_categories (id),
  vendor_name text null,
  description text not null,
  currency_code text not null default 'USD',
  amount numeric(14, 2) not null,
  expense_date date not null default current_date,
  receipt_provider_file_id text null,
  is_billable_to_client boolean not null default false,
  rebill_client_id uuid null references public.clients (id),
  rebill_invoice_id uuid null references public.invoices (id),
  approval_status expense_approval_status not null default 'not_required',
  submitted_by_user_id uuid not null references public.users (id),
  approved_by_user_id uuid null references public.users (id),
  approved_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create index expenses_company_id_idx on public.expenses (company_id) where deleted_at is null;
create index expenses_category_id_idx on public.expenses (category_id) where category_id is not null;
create index expenses_expense_date_idx on public.expenses (company_id, expense_date) where deleted_at is null;
create index expenses_approval_status_idx
  on public.expenses (company_id, approval_status)
  where approval_status = 'pending' and deleted_at is null;

comment on table public.expenses is
  'A single recorded business expense, optionally rebillable to a client invoice and optionally subject to an approval flow (R7.6).';
