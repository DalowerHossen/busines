-- supabase/migrations/00153_bnpl_installments.sql
-- Installment schedule returned by a BNPL provider.

create table public.bnpl_installments (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  application_id uuid not null references public.bnpl_applications (id) on delete cascade,
  installment_number integer not null,
  due_date date not null,
  amount numeric(18, 4) not null,
  currency_code text not null default 'USD',
  status bnpl_installment_status not null default 'scheduled',
  paid_at timestamptz null,
  external_installment_id text null,
  failure_reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bnpl_installments_number_positive check (installment_number > 0),
  constraint bnpl_installments_amount_positive check (amount > 0),
  constraint bnpl_installments_paid_fields_valid check (
    (status = 'paid' and paid_at is not null) or status <> 'paid'
  )
);

create unique index bnpl_installments_application_number_key
  on public.bnpl_installments (application_id, installment_number);
create unique index bnpl_installments_external_id_key
  on public.bnpl_installments (external_installment_id)
  where external_installment_id is not null;
create index bnpl_installments_due_queue_idx
  on public.bnpl_installments (company_id, due_date, status)
  where status in ('scheduled', 'overdue');

comment on table public.bnpl_installments is
  'One scheduled or settled installment in a BNPL application repayment plan.';
