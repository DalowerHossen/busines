-- supabase/migrations/00184_create_loyalty_program.sql
-- Rewarding the clients who keep paying.
--
-- Points are money that has not been spent yet, so they are kept like money:
-- every movement is a row, the balance is derived from those rows, and
-- nothing is ever edited in place.

create table public.loyalty_programs (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,

  name text not null,
  description text,
  is_active boolean not null default true,

  -- How points are earned.
  points_per_currency_unit numeric(12, 4) not null default 1,
  earn_on text not null default 'payment',
  minimum_spend numeric(18, 4) not null default 0,
  -- How points are spent.
  point_value numeric(12, 6) not null default 0.01,
  minimum_redemption_points integer not null default 100,
  redemption_multiple integer not null default 100,

  points_expire_after_months smallint,
  expiry_warning_days smallint not null default 30,

  -- Tiers, expressed as the points needed to reach each one.
  silver_threshold integer,
  gold_threshold integer,
  platinum_threshold integer,
  tier_review_months smallint not null default 12,

  terms_url text,
  currency char(3) not null default 'USD',

  member_count integer not null default 0,
  points_issued bigint not null default 0,
  points_redeemed bigint not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint loyalty_programs_name_check
    check (length(btrim(name)) between 2 and 80),
  constraint loyalty_programs_earn_check
    check (earn_on in ('payment', 'invoice_paid', 'subscription_renewal',
                       'referral', 'manual')),
  constraint loyalty_programs_rate_check
    check (points_per_currency_unit > 0 and point_value > 0),
  constraint loyalty_programs_redemption_check
    check (minimum_redemption_points > 0 and redemption_multiple > 0),
  constraint loyalty_programs_expiry_check
    check (points_expire_after_months is null
           or points_expire_after_months between 1 and 120),
  constraint loyalty_programs_tier_check
    check (
      (silver_threshold is null or silver_threshold > 0)
      and (gold_threshold is null or silver_threshold is null
           or gold_threshold > silver_threshold)
      and (platinum_threshold is null or gold_threshold is null
           or platinum_threshold > gold_threshold)
    ),
  constraint loyalty_programs_currency_check
    check (currency ~ '^[A-Z]{3}$'),
  constraint loyalty_programs_counts_check
    check (member_count >= 0 and points_issued >= 0 and points_redeemed >= 0)
);

comment on table public.loyalty_programs is
  'A points scheme a business runs for the clients who keep coming back.';

create unique index loyalty_programs_company_unique
  on public.loyalty_programs (company_id)
  where is_active and deleted_at is null;

-- -----------------------------------------------------------------------------
-- Members
-- -----------------------------------------------------------------------------

create table public.loyalty_accounts (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  program_id uuid not null,
  client_id uuid not null,

  membership_number text not null,
  tier text not null default 'standard',
  tier_achieved_at timestamptz,
  tier_reviewed_at timestamptz,

  points_balance integer not null default 0,
  points_earned_lifetime bigint not null default 0,
  points_redeemed_lifetime bigint not null default 0,
  points_expired_lifetime bigint not null default 0,

  joined_at timestamptz not null default now(),
  last_earned_at timestamptz,
  last_redeemed_at timestamptz,
  next_expiry_date date,

  is_suspended boolean not null default false,
  suspension_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint loyalty_accounts_number_check
    check (membership_number ~ '^LY-[0-9]{4,10}$'),
  constraint loyalty_accounts_tier_check
    check (tier in ('standard', 'silver', 'gold', 'platinum')),
  constraint loyalty_accounts_balance_check
    check (points_balance >= 0 and points_earned_lifetime >= 0
           and points_redeemed_lifetime >= 0 and points_expired_lifetime >= 0),
  constraint loyalty_accounts_suspension_check
    check (not is_suspended or suspension_reason is not null)
);

comment on table public.loyalty_accounts is
  'One client inside a loyalty programme, with the balance they hold.';

create unique index loyalty_accounts_client_unique
  on public.loyalty_accounts (program_id, client_id)
  where deleted_at is null;

create unique index loyalty_accounts_number_unique
  on public.loyalty_accounts (company_id, membership_number);

create index loyalty_accounts_expiry_idx
  on public.loyalty_accounts (next_expiry_date)
  where next_expiry_date is not null and deleted_at is null;

-- -----------------------------------------------------------------------------
-- Movements
-- -----------------------------------------------------------------------------

create table public.loyalty_transactions (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  account_id uuid not null,

  entry_type text not null,
  points integer not null,
  balance_after integer not null,

  -- What caused it, so a client can be told why.
  reason text not null,
  payment_id uuid,
  invoice_id uuid,
  reward_id uuid,
  redemption_id uuid,

  -- Earned points carry their own expiry, oldest spent first.
  expires_on date,
  expired_at timestamptz,
  reversal_of_id uuid,

  created_at timestamptz not null default now(),
  created_by uuid,

  constraint loyalty_transactions_type_check
    check (entry_type in ('earned', 'redeemed', 'expired', 'adjusted',
                          'reversed', 'bonus')),
  constraint loyalty_transactions_points_check
    check (points <> 0),
  constraint loyalty_transactions_direction_check
    check (
      (entry_type in ('earned', 'bonus') and points > 0)
      or (entry_type in ('redeemed', 'expired') and points < 0)
      or entry_type in ('adjusted', 'reversed')
    ),
  constraint loyalty_transactions_balance_check
    check (balance_after >= 0),
  constraint loyalty_transactions_reason_check
    check (length(btrim(reason)) between 3 and 200)
);

comment on table public.loyalty_transactions is
  'Every movement of points, which together make the balance.';

create index loyalty_transactions_account_idx
  on public.loyalty_transactions (account_id, created_at desc);

create index loyalty_transactions_expiry_idx
  on public.loyalty_transactions (expires_on)
  where entry_type in ('earned', 'bonus') and expired_at is null;

-- -----------------------------------------------------------------------------
-- What points buy
-- -----------------------------------------------------------------------------

create table public.loyalty_rewards (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  program_id uuid not null,

  name text not null,
  description text,
  reward_type text not null default 'invoice_credit',

  points_cost integer not null,
  credit_amount numeric(18, 4),
  discount_percentage numeric(5, 2),
  product_id uuid,

  minimum_tier text not null default 'standard',
  stock_quantity integer,
  redeemed_count integer not null default 0,
  per_member_limit integer,

  is_active boolean not null default true,
  available_from date,
  available_until date,
  display_order smallint not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint loyalty_rewards_name_check
    check (length(btrim(name)) between 2 and 80),
  constraint loyalty_rewards_type_check
    check (reward_type in ('invoice_credit', 'percentage_discount',
                           'free_product', 'service_upgrade', 'donation')),
  constraint loyalty_rewards_cost_check
    check (points_cost > 0),
  constraint loyalty_rewards_value_check
    check (
      (reward_type = 'invoice_credit' and credit_amount > 0)
      or (reward_type = 'percentage_discount'
          and discount_percentage > 0 and discount_percentage <= 100)
      or reward_type in ('free_product', 'service_upgrade', 'donation')
    ),
  constraint loyalty_rewards_tier_check
    check (minimum_tier in ('standard', 'silver', 'gold', 'platinum')),
  constraint loyalty_rewards_stock_check
    check (stock_quantity is null or stock_quantity >= 0),
  constraint loyalty_rewards_window_check
    check (available_from is null or available_until is null
           or available_until >= available_from)
);

comment on table public.loyalty_rewards is
  'Something a member can exchange their points for.';

create index loyalty_rewards_program_idx
  on public.loyalty_rewards (program_id, display_order)
  where is_active and deleted_at is null;

create table public.loyalty_redemptions (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  account_id uuid not null,
  reward_id uuid not null,

  redemption_code text not null,
  points_spent integer not null,
  reward_value numeric(18, 4),
  currency char(3) not null default 'USD',

  status text not null default 'issued',
  issued_at timestamptz not null default now(),
  expires_on date,
  applied_at timestamptz,
  applied_to_invoice_id uuid,
  cancelled_at timestamptz,
  cancellation_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,

  constraint loyalty_redemptions_code_check
    check (redemption_code ~ '^[A-Z0-9]{8,16}$'),
  constraint loyalty_redemptions_points_check
    check (points_spent > 0),
  constraint loyalty_redemptions_currency_check
    check (currency ~ '^[A-Z]{3}$'),
  constraint loyalty_redemptions_status_check
    check (status in ('issued', 'applied', 'expired', 'cancelled')),
  constraint loyalty_redemptions_applied_check
    check (status <> 'applied' or applied_at is not null),
  constraint loyalty_redemptions_cancelled_check
    check (status <> 'cancelled' or cancellation_reason is not null)
);

comment on table public.loyalty_redemptions is
  'A reward a member has claimed, and whether it has been used yet.';

create unique index loyalty_redemptions_code_unique
  on public.loyalty_redemptions (company_id, redemption_code);

create index loyalty_redemptions_account_idx
  on public.loyalty_redemptions (account_id, issued_at desc);
