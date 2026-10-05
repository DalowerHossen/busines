-- supabase/migrations/00054_recurring_expenses.sql
-- A recurring expense schedule that a scheduled job uses to create new
-- expenses on a cadence, mirroring recurring_invoice_templates from Phase
-- 8 but for outgoing money. Reuses the recurring_invoice_frequency enum
-- from Phase 8 rather than duplicating it (see 00051's comment).

create table public.recurring_expenses (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  category_id uuid null references public.expense_categories (id),
  description text not null,
  currency_code text not null default 'USD',
  amount numeric(14, 2) not null,
  frequency recurring_invoice_frequency not null,
  next_run_date date not null,
  end_date date null,
  is_active boolean not null default true,
  last_generated_expense_id uuid null references public.expenses (id),
  created_by_user_id uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create index recurring_expenses_company_id_idx
  on public.recurring_expenses (company_id)
  where deleted_at is null;
create index recurring_expenses_next_run_date_idx
  on public.recurring_expenses (next_run_date)
  where is_active = true and deleted_at is null;

comment on table public.recurring_expenses is
  'A recurring expense schedule. A scheduled job (Phase 19 cron function) creates a new expense whenever next_run_date is reached.';
