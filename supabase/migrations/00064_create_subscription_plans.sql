-- supabase/migrations/00064_create_subscription_plans.sql
-- The plans the platform sells to its tenants.
--
-- A plan describes what a tenant may do: how many invoices and clients, how
-- much storage, which modules are unlocked. Limits live in one jsonb document
-- so a new limit can be introduced without a schema change, and every limit is
-- read through a single resolver, never inline in a screen.

create table public.subscription_plans (
  id uuid primary key default public.generate_uuid_v7(),

  -- Stable identifier used in code and in the pricing page, for example free,
  -- starter, professional, business.
  plan_key text not null,
  name text not null,
  tagline text,
  description text,

  is_public boolean not null default true,
  is_free boolean not null default false,
  is_default_on_signup boolean not null default false,
  is_archived boolean not null default false,

  trial_days smallint not null default 0,
  display_order smallint not null default 0,
  badge_label text,

  -- Limits. A null value inside the document means unlimited.
  limits jsonb not null default '{}'::jsonb,
  -- Module switches, for example {"inventory": true, "projects": false}.
  features jsonb not null default '{}'::jsonb,

  -- Fees the platform keeps when it collects on behalf of the tenant.
  merchant_of_record_fee_percentage numeric(7, 4) not null default 0,
  merchant_of_record_fee_fixed numeric(18, 4) not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint subscription_plans_key_check
    check (plan_key ~ '^[a-z][a-z0-9_]{1,30}$'),
  constraint subscription_plans_name_check
    check (length(btrim(name)) between 1 and 60),
  constraint subscription_plans_limits_check
    check (jsonb_typeof(limits) = 'object'),
  constraint subscription_plans_features_check
    check (jsonb_typeof(features) = 'object'),
  constraint subscription_plans_trial_check
    check (trial_days between 0 and 90),
  constraint subscription_plans_fee_check
    check (merchant_of_record_fee_percentage between 0 and 100
           and merchant_of_record_fee_fixed >= 0)
);

comment on table public.subscription_plans is
  'Plans the platform sells, with the limits and modules each one unlocks.';
comment on column public.subscription_plans.limits is
  'Usage ceilings; a null entry means the plan places no limit on that item.';

create unique index subscription_plans_key_unique
  on public.subscription_plans (plan_key)
  where deleted_at is null;

create unique index subscription_plans_signup_default_unique
  on public.subscription_plans ((true))
  where is_default_on_signup and deleted_at is null and not is_archived;

create index subscription_plans_public_idx
  on public.subscription_plans (display_order)
  where is_public and not is_archived and deleted_at is null;

-- -----------------------------------------------------------------------------
-- Prices
-- -----------------------------------------------------------------------------

-- A plan carries one price per interval and currency, so the same plan can be
-- sold monthly, annually and in several currencies without duplication.
create table public.plan_prices (
  id uuid primary key default public.generate_uuid_v7(),
  plan_id uuid not null,

  billing_interval public.billing_interval not null default 'monthly',
  currency char(3) not null default 'USD',
  amount numeric(18, 4) not null,
  amount_minor bigint not null default 0,

  -- Price shown struck through on the pricing page.
  compare_at_amount numeric(18, 4),
  is_active boolean not null default true,

  -- References at the providers that bill the subscription.
  stripe_price_reference text,
  paddle_price_reference text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint plan_prices_currency_check
    check (currency ~ '^[A-Z]{3}$'),
  constraint plan_prices_amount_check
    check (amount >= 0),
  constraint plan_prices_compare_check
    check (compare_at_amount is null or compare_at_amount >= amount)
);

comment on table public.plan_prices is
  'The amount a plan costs for one interval in one currency.';

create unique index plan_prices_unique
  on public.plan_prices (plan_id, billing_interval, currency)
  where deleted_at is null;

create index plan_prices_active_idx
  on public.plan_prices (plan_id)
  where is_active and deleted_at is null;

-- Returns the limits and features of a plan, merged with the platform
-- defaults, so a caller always receives a complete document.
create or replace function public.plan_entitlements(p_plan_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
           'plan_key', p.plan_key,
           'limits', p.limits,
           'features', p.features,
           'trial_days', p.trial_days,
           'merchant_of_record_fee_percentage', p.merchant_of_record_fee_percentage,
           'merchant_of_record_fee_fixed', p.merchant_of_record_fee_fixed
         )
    from public.subscription_plans as p
   where p.id = p_plan_id
     and p.deleted_at is null;
$$;

comment on function public.plan_entitlements(uuid) is
  'Returns the limits, modules and fees that belong to one plan.';
