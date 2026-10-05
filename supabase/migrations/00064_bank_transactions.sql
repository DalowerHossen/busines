-- supabase/migrations/00064_bank_transactions.sql
-- One imported or manually entered bank transaction (EE6.2 auto import,
-- EE6.12 manual entry). amount is signed: positive for a deposit/credit,
-- negative for a withdrawal/debit. external_transaction_id plus the
-- unique index below make CSV/API re-import idempotent (EE6.1, P7.10).

create table public.bank_transactions (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  bank_account_id uuid not null references public.bank_accounts (id),
  transaction_date date not null,
  description text not null,
  amount numeric(14, 2) not null,
  external_transaction_id text null,
  is_reconciled boolean not null default false,
  matched_payment_id uuid null references public.payments (id),
  matched_expense_id uuid null references public.expenses (id),
  matched_bill_id uuid null references public.bills (id),
  reconciled_at timestamptz null,
  reconciled_by_user_id uuid null references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create unique index bank_transactions_external_id_key
  on public.bank_transactions (bank_account_id, external_transaction_id)
  where external_transaction_id is not null;
create index bank_transactions_bank_account_id_idx
  on public.bank_transactions (bank_account_id)
  where deleted_at is null;
create index bank_transactions_company_id_idx on public.bank_transactions (company_id);
create index bank_transactions_unreconciled_idx
  on public.bank_transactions (company_id)
  where is_reconciled = false and deleted_at is null;

comment on table public.bank_transactions is
  'One bank transaction, imported or manually entered. EE6.7''s "unmatched queue" is simply the is_reconciled = false rows.';
