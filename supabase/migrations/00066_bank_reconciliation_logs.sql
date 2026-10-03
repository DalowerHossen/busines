-- supabase/migrations/00066_bank_reconciliation_logs.sql
-- An append-only reconciliation audit trail entry for one bank transaction
-- (EE6.13). performed_by_user_id is null for a system/rule-engine action
-- (EE6.6) rather than a human-initiated one.

create table public.bank_reconciliation_logs (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  bank_transaction_id uuid not null references public.bank_transactions (id),
  action text not null,
  performed_by_user_id uuid null references public.users (id),
  notes text null,
  created_at timestamptz not null default now()
);

create index bank_reconciliation_logs_bank_transaction_id_idx
  on public.bank_reconciliation_logs (bank_transaction_id);
create index bank_reconciliation_logs_company_id_idx
  on public.bank_reconciliation_logs (company_id);

comment on table public.bank_reconciliation_logs is
  'Append-only reconciliation audit trail (EE6.13). Never updated or deleted once written.';
