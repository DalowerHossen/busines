-- supabase/migrations/00065_bank_matching_rules.sql
-- A bank-feed auto-matching rule (EE6.6) applied to incoming transactions
-- to suggest or auto-assign a category/match (EE6.4 match suggestion).
-- The rule EVALUATION engine is application logic added in a later phase;
-- this migration only defines the rule shape.

create table public.bank_matching_rules (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  match_field text not null,
  match_pattern text not null,
  target_category_id uuid null references public.expense_categories (id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint bank_matching_rules_match_field_valid check (match_field in ('description', 'amount'))
);

create index bank_matching_rules_company_id_idx
  on public.bank_matching_rules (company_id)
  where deleted_at is null and is_active = true;

comment on table public.bank_matching_rules is
  'A bank-feed auto-matching rule (EE6.6). The evaluation engine itself is application logic added in a later phase.';
