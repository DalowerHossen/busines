-- supabase/migrations/00055_income.sql
-- A manually recorded income entry not produced by an invoice payment
-- (for example interest income or a one-off sale recorded outside the
-- invoicing flow). `category` is a free-text field rather than its own
-- lookup table, since no dedicated income-category feature is catalogued
-- (unlike expenses, which do have one -- expense_categories).

create table public.income (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  source text not null,
  category text null,
  description text null,
  currency_code text not null default 'USD',
  amount numeric(14, 2) not null,
  income_date date not null default current_date,
  client_id uuid null references public.clients (id),
  created_by_user_id uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create index income_company_id_idx on public.income (company_id) where deleted_at is null;
create index income_income_date_idx on public.income (company_id, income_date) where deleted_at is null;
create index income_client_id_idx on public.income (client_id) where client_id is not null;

comment on table public.income is
  'A manually recorded income entry not produced by an invoice payment (which already has its own ledger via payments/invoices).';
