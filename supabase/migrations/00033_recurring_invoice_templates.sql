-- supabase/migrations/00033_recurring_invoice_templates.sql
-- A recurring BILLING SCHEDULE that a scheduled job uses to create new
-- invoices on a cadence (matches src/types/invoice.ts
-- RecurringInvoiceTemplate). This is unrelated to invoice_templates added
-- in 00030, which is a visual PDF layout -- the similar names are an
-- unavoidable collision already locked by the Phase 3 TypeScript catalog;
-- this comment exists in both files to prevent future confusion.
--
-- Table name intentionally kept singular-concept as "recurring invoice
-- templates" (the recurring schedule, not its rendering), per the locked
-- TS interface name.

create type recurring_invoice_frequency as enum (
  'weekly',
  'biweekly',
  'monthly',
  'quarterly',
  'yearly'
);

create table public.recurring_invoice_templates (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  client_id uuid not null references public.clients (id),
  frequency recurring_invoice_frequency not null,
  next_run_date date not null,
  end_date date null,
  currency_code text not null default 'USD',
  notes text null,
  is_active boolean not null default true,
  last_generated_invoice_id uuid null references public.invoices (id),
  created_by_user_id uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create index recurring_invoice_templates_company_id_idx
  on public.recurring_invoice_templates (company_id)
  where deleted_at is null;
create index recurring_invoice_templates_client_id_idx
  on public.recurring_invoice_templates (client_id);
create index recurring_invoice_templates_next_run_date_idx
  on public.recurring_invoice_templates (next_run_date)
  where is_active = true and deleted_at is null;

comment on table public.recurring_invoice_templates is
  'A recurring billing schedule. A scheduled job (added as a Supabase Edge cron function in Phase 19) creates a new invoice from this schedule''s line items whenever next_run_date is reached.';
