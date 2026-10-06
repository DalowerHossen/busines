-- supabase/migrations/00109_platform_fee_rules.sql
-- Platform-level and company-level Merchant of Record fee policy. A company
-- override is resolved before the platform default by later application code.

create table public.platform_fee_rules (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid null references public.companies (id),
  rule_name text not null,
  percentage_rate numeric(7, 4) not null default 0,
  minimum_fee_amount numeric(18, 4) not null default 0,
  fixed_fee_amount numeric(18, 4) not null default 0,
  currency_code text not null default 'USD',
  hold_period_days integer not null default 7,
  payout_sla_hours integer not null default 24,
  minimum_payout_amount numeric(18, 4) not null default 0,
  is_active boolean not null default true,
  effective_from timestamptz not null default now(),
  effective_until timestamptz null,
  created_by_user_id uuid null references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint platform_fee_rules_name_not_blank check (length(btrim(rule_name)) > 0),
  constraint platform_fee_rules_rate_valid check (percentage_rate between 0 and 100),
  constraint platform_fee_rules_amounts_non_negative check (
    minimum_fee_amount >= 0 and fixed_fee_amount >= 0 and minimum_payout_amount >= 0
  ),
  constraint platform_fee_rules_hold_period_valid check (hold_period_days between 0 and 365),
  constraint platform_fee_rules_payout_sla_valid check (payout_sla_hours > 0),
  constraint platform_fee_rules_scope_creator check (
    company_id is not null or created_by_user_id is null
  ),
  constraint platform_fee_rules_effective_window_valid check (
    effective_until is null or effective_until > effective_from
  )
);

create unique index platform_fee_rules_platform_name_key
  on public.platform_fee_rules (lower(rule_name))
  where company_id is null and deleted_at is null;
create unique index platform_fee_rules_company_name_key
  on public.platform_fee_rules (company_id, lower(rule_name))
  where company_id is not null and deleted_at is null;
create index platform_fee_rules_active_idx
  on public.platform_fee_rules (company_id, is_active, effective_from desc)
  where is_active = true and deleted_at is null;

comment on table public.platform_fee_rules is
  'A platform default or company-specific fee and settlement policy for Merchant of Record payments.';
