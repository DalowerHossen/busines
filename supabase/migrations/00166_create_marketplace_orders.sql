-- supabase/migrations/00166_create_marketplace_orders.sql
-- Buying a template, installing it, and splitting the money.

create table public.marketplace_orders (
  id uuid primary key default public.generate_uuid_v7(),

  order_reference text not null,
  listing_id uuid not null,
  listing_version text not null,
  vendor_id uuid not null,
  -- The tenant who bought it.
  company_id uuid not null,
  purchased_by uuid,

  pricing_model text not null,
  gross_amount numeric(18, 4) not null,
  tax_amount numeric(18, 4) not null default 0,
  platform_fee_amount numeric(18, 4) not null default 0,
  vendor_amount numeric(18, 4) not null default 0,
  currency char(3) not null default 'USD',
  revenue_share_percentage numeric(5, 2) not null,

  status text not null default 'pending',
  payment_reference text,
  paid_at timestamptz,
  refunded_at timestamptz,
  refund_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint marketplace_orders_reference_check
    check (order_reference ~ '^MO-[0-9]{4,10}$'),
  constraint marketplace_orders_pricing_check
    check (pricing_model in ('free', 'one_time', 'subscription')),
  constraint marketplace_orders_amounts_check
    check (gross_amount >= 0 and tax_amount >= 0
           and platform_fee_amount >= 0 and vendor_amount >= 0),
  constraint marketplace_orders_split_check
    check (vendor_amount + platform_fee_amount = gross_amount),
  constraint marketplace_orders_currency_check
    check (currency ~ '^[A-Z]{3}$'),
  constraint marketplace_orders_share_check
    check (revenue_share_percentage between 0 and 100),
  constraint marketplace_orders_status_check
    check (status in ('pending', 'paid', 'failed', 'refunded', 'cancelled')),
  constraint marketplace_orders_paid_check
    check (status not in ('paid', 'refunded') or paid_at is not null),
  constraint marketplace_orders_refund_check
    check (status <> 'refunded' or refunded_at is not null),
  constraint marketplace_orders_version_check
    check (listing_version ~ '^[0-9]+\.[0-9]+\.[0-9]+$')
);

comment on table public.marketplace_orders is
  'One purchase of one marketplace listing by one tenant.';

create unique index marketplace_orders_reference_unique
  on public.marketplace_orders (order_reference);

create index marketplace_orders_company_idx
  on public.marketplace_orders (company_id, created_at desc);

create index marketplace_orders_vendor_idx
  on public.marketplace_orders (vendor_id, status, created_at desc);

-- -----------------------------------------------------------------------------
-- Installs
-- -----------------------------------------------------------------------------

create table public.marketplace_installs (
  id uuid primary key default public.generate_uuid_v7(),
  listing_id uuid not null,
  company_id uuid not null,
  order_id uuid,

  installed_version text not null,
  -- What the install actually created inside the tenant, so it can be undone.
  created_record_ids jsonb not null default '[]'::jsonb,
  configuration jsonb not null default '{}'::jsonb,

  status text not null default 'installed',
  installed_at timestamptz not null default now(),
  installed_by uuid,
  updated_version_at timestamptz,
  uninstalled_at timestamptz,
  uninstall_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint marketplace_installs_version_check
    check (installed_version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  constraint marketplace_installs_status_check
    check (status in ('installed', 'update_available', 'uninstalled', 'failed')),
  constraint marketplace_installs_uninstalled_check
    check (status <> 'uninstalled' or uninstalled_at is not null)
);

comment on table public.marketplace_installs is
  'A listing that is live inside a tenant, with what it created.';

create unique index marketplace_installs_active_unique
  on public.marketplace_installs (listing_id, company_id)
  where status <> 'uninstalled';

create index marketplace_installs_company_idx
  on public.marketplace_installs (company_id, status);

-- -----------------------------------------------------------------------------
-- Vendor earnings
-- -----------------------------------------------------------------------------

create table public.marketplace_vendor_earnings (
  id uuid primary key default public.generate_uuid_v7(),
  vendor_id uuid not null,
  order_id uuid not null,

  amount numeric(18, 4) not null,
  currency char(3) not null default 'USD',
  status text not null default 'pending',
  available_at date,
  payout_id uuid,
  reversed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint marketplace_vendor_earnings_amount_check
    check (amount >= 0),
  constraint marketplace_vendor_earnings_currency_check
    check (currency ~ '^[A-Z]{3}$'),
  constraint marketplace_vendor_earnings_status_check
    check (status in ('pending', 'available', 'paid', 'reversed'))
);

comment on table public.marketplace_vendor_earnings is
  'The vendor share of one marketplace order, held until it clears.';

create unique index marketplace_vendor_earnings_order_unique
  on public.marketplace_vendor_earnings (order_id);

create index marketplace_vendor_earnings_payable_idx
  on public.marketplace_vendor_earnings (vendor_id, status, available_at);

create table public.marketplace_vendor_payouts (
  id uuid primary key default public.generate_uuid_v7(),
  vendor_id uuid not null,

  payout_reference text not null,
  period_start date not null,
  period_end date not null,
  gross_amount numeric(18, 4) not null default 0,
  fee_amount numeric(18, 4) not null default 0,
  net_amount numeric(18, 4) not null default 0,
  currency char(3) not null default 'USD',
  earning_count integer not null default 0,

  status text not null default 'draft',
  payout_method text,
  external_reference text,
  paid_at timestamptz,
  failure_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint marketplace_vendor_payouts_reference_check
    check (payout_reference ~ '^MP-[0-9]{4,10}$'),
  constraint marketplace_vendor_payouts_period_check
    check (period_end >= period_start),
  constraint marketplace_vendor_payouts_amounts_check
    check (gross_amount >= 0 and fee_amount >= 0 and net_amount >= 0),
  constraint marketplace_vendor_payouts_arithmetic_check
    check (net_amount = gross_amount - fee_amount),
  constraint marketplace_vendor_payouts_currency_check
    check (currency ~ '^[A-Z]{3}$'),
  constraint marketplace_vendor_payouts_status_check
    check (status in ('draft', 'approved', 'processing', 'paid', 'failed',
                      'cancelled')),
  constraint marketplace_vendor_payouts_paid_check
    check (status <> 'paid' or paid_at is not null),
  constraint marketplace_vendor_payouts_count_check
    check (earning_count >= 0)
);

comment on table public.marketplace_vendor_payouts is
  'One payment of accumulated marketplace earnings to a vendor.';

create unique index marketplace_vendor_payouts_reference_unique
  on public.marketplace_vendor_payouts (vendor_id, payout_reference);
