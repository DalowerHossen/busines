-- supabase/migrations/00154_loyalty_programs.sql
-- Tenant loyalty program configuration.

create table public.loyalty_programs (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  name text not null,
  points_per_currency_unit numeric(18, 8) not null default 1,
  currency_code text not null default 'USD',
  point_expiry_days integer null,
  is_active boolean not null default false,
  created_by_user_id uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint loyalty_programs_name_not_blank check (length(btrim(name)) > 0),
  constraint loyalty_programs_points_rate_positive check (points_per_currency_unit > 0),
  constraint loyalty_programs_expiry_valid check (point_expiry_days is null or point_expiry_days > 0)
);

create unique index loyalty_programs_company_name_key
  on public.loyalty_programs (company_id, lower(name))
  where deleted_at is null;
create unique index loyalty_programs_one_active_key
  on public.loyalty_programs (company_id)
  where is_active = true and deleted_at is null;

comment on table public.loyalty_programs is
  'A tenant loyalty points configuration with earn rate and optional expiry.';
