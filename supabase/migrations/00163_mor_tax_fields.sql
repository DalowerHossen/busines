-- supabase/migrations/00163_mor_tax_fields.sql
-- Explicitly freezes tax treatment and settlement evidence on Merchant of
-- Record payments without changing the existing payment amount semantics.

alter table public.payments
  add column tax_transaction_record_id uuid null references public.tax_transaction_records (id),
  add column tax_reporting_payee_company_id uuid null references public.companies (id),
  add column tax_reporting_gross_amount numeric(18, 4) null,
  add column tax_reporting_transaction_count integer null,
  add column backup_withholding_amount numeric(18, 4) not null default 0,
  add column tax_policy_version text null;

alter table public.payments
  add constraint payments_tax_reporting_amount_valid check (
    tax_reporting_gross_amount is null or tax_reporting_gross_amount >= 0
  ),
  add constraint payments_tax_reporting_count_valid check (
    tax_reporting_transaction_count is null or tax_reporting_transaction_count >= 0
  ),
  add constraint payments_backup_withholding_valid check (backup_withholding_amount >= 0);

create index payments_tax_reporting_payee_idx
  on public.payments (tax_reporting_payee_company_id, created_at desc)
  where tax_reporting_payee_company_id is not null;

comment on column public.payments.tax_policy_version is
  'The tax policy snapshot used for this payment. Later super-admin policy edits never rewrite this historical value.';
