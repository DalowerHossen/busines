-- supabase/migrations/00164_tax_withholding.sql
-- Separate withholding evidence from payment totals. A withholding entry is
-- immutable; corrections are compensating entries with a new evidence record.

create table public.tax_withholding_entries (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  payment_id uuid null references public.payments (id),
  payout_request_id uuid null references public.payout_requests (id),
  payee_tax_profile_id uuid not null references public.payee_tax_profiles (id),
  tax_year smallint not null,
  withholding_type text not null default 'backup_withholding',
  gross_payment_amount numeric(18, 4) not null,
  withholding_rate numeric(7, 4) not null,
  withholding_amount numeric(18, 4) not null,
  reason_code text not null,
  evidence_snapshot jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now(),
  recorded_by_user_id uuid null references public.users (id),
  reversal_of_id uuid null references public.tax_withholding_entries (id),
  constraint tax_withholding_entries_source_present check (
    (payment_id is not null) <> (payout_request_id is not null)
  ),
  constraint tax_withholding_entries_year_valid check (tax_year between 2020 and 2200),
  constraint tax_withholding_entries_amounts_valid check (
    gross_payment_amount >= 0 and withholding_rate between 0 and 100 and withholding_amount >= 0
  ),
  constraint tax_withholding_entries_reason_not_blank check (length(btrim(reason_code)) > 0)
);

create unique index tax_withholding_entries_payment_key
  on public.tax_withholding_entries (payment_id, payee_tax_profile_id, tax_year, withholding_type)
  where payment_id is not null and reversal_of_id is null;
create unique index tax_withholding_entries_payout_key
  on public.tax_withholding_entries (payout_request_id, payee_tax_profile_id, tax_year, withholding_type)
  where payout_request_id is not null and reversal_of_id is null;
create index tax_withholding_entries_payee_year_idx
  on public.tax_withholding_entries (payee_tax_profile_id, tax_year, recorded_at desc);

comment on table public.tax_withholding_entries is
  'Auditable backup-withholding evidence. TINs and source documents remain encrypted or external; snapshots contain no plaintext TIN.';
