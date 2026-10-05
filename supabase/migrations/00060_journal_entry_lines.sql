-- supabase/migrations/00060_journal_entry_lines.sql
-- One debit or credit line within a journal_entries row. A CHECK
-- constraint enforces the standard double-entry convention that exactly
-- one side of each individual line is non-zero; whether a whole entry's
-- lines balance (total debits = total credits) is an application-layer
-- invariant enforced at insert/update time, not expressible as a single-
-- row CHECK constraint.

create table public.journal_entry_lines (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  journal_entry_id uuid not null references public.journal_entries (id),
  account_id uuid not null references public.chart_of_accounts (id),
  debit_amount numeric(14, 2) not null default 0,
  credit_amount numeric(14, 2) not null default 0,
  description text null,
  created_at timestamptz not null default now(),
  constraint journal_entry_lines_amounts_non_negative
    check (debit_amount >= 0 and credit_amount >= 0),
  constraint journal_entry_lines_exactly_one_side
    check (
      (debit_amount > 0 and credit_amount = 0)
      or (credit_amount > 0 and debit_amount = 0)
    )
);

create index journal_entry_lines_journal_entry_id_idx
  on public.journal_entry_lines (journal_entry_id);
create index journal_entry_lines_account_id_idx on public.journal_entry_lines (account_id);
create index journal_entry_lines_company_id_idx on public.journal_entry_lines (company_id);

comment on table public.journal_entry_lines is
  'One debit or credit line within a journal entry. Immutable once posted -- correct a mistake with a new offsetting entry, not an edit.';
