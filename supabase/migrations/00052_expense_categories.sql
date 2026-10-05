-- supabase/migrations/00052_expense_categories.sql
-- A named grouping for expenses (for example "Software" or "Travel").
-- is_default rows are seeded in Phase 19 (expense categories listed in
-- PHASE-PLAN.md's seed-data scope); this migration only creates the table.

create table public.expense_categories (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  name text not null,
  color text null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create index expense_categories_company_id_idx
  on public.expense_categories (company_id)
  where deleted_at is null;

comment on table public.expense_categories is
  'A named grouping for expenses. Default rows are seeded per company in Phase 19.';
