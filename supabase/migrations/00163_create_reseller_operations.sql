-- supabase/migrations/00163_create_reseller_operations.sql
-- Running a white label business: tenants, earnings and statements.
--
-- The hard rule of this file, and of the policies that come later, is that a
-- partner manages accounts without ever reading what is inside them. They see
-- that a tenant exists, which plan it is on and what it owes them. They never
-- see an invoice, a client or a document belonging to that tenant.

create table public.reseller_tenant_links (
  id uuid primary key default public.generate_uuid_v7(),
  reseller_id uuid not null,
  company_id uuid not null,

  -- What the partner calls this account internally.
  account_reference text,
  price_book_id uuid,

  status text not null default 'active',
  provisioned_at timestamptz not null default now(),
  suspended_at timestamptz,
  suspension_reason text,
  released_at timestamptz,

  -- Running totals, maintained by the commission routines.
  lifetime_retail_amount numeric(18, 4) not null default 0,
  lifetime_commission_amount numeric(18, 4) not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint reseller_tenant_links_status_check
    check (status in ('active', 'suspended', 'released')),
  constraint reseller_tenant_links_reference_check
    check (account_reference is null
           or length(btrim(account_reference)) between 1 and 60),
  constraint reseller_tenant_links_suspension_check
    check (status <> 'suspended' or suspended_at is not null),
  constraint reseller_tenant_links_release_check
    check (status <> 'released' or released_at is not null),
  constraint reseller_tenant_links_totals_check
    check (lifetime_retail_amount >= 0 and lifetime_commission_amount >= 0)
);

comment on table public.reseller_tenant_links is
  'An account a white label partner manages, with no access to what is inside.';

create unique index reseller_tenant_links_company_unique
  on public.reseller_tenant_links (company_id);

create index reseller_tenant_links_reseller_idx
  on public.reseller_tenant_links (reseller_id, status);

-- -----------------------------------------------------------------------------
-- Earnings
-- -----------------------------------------------------------------------------

create table public.reseller_commissions (
  id uuid primary key default public.generate_uuid_v7(),
  reseller_id uuid not null,
  company_id uuid not null,

  -- The platform invoice this commission was earned on.
  subscription_invoice_id uuid,
  period_start date not null,
  period_end date not null,

  retail_amount numeric(18, 4) not null,
  wholesale_amount numeric(18, 4) not null,
  commission_amount numeric(18, 4) not null,
  currency char(3) not null default 'USD',

  status text not null default 'pending',
  -- A commission is only payable once the tenant actually paid.
  earned_at timestamptz,
  payout_id uuid,
  reversed_at timestamptz,
  reversal_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint reseller_commissions_period_check
    check (period_end >= period_start),
  constraint reseller_commissions_amounts_check
    check (retail_amount >= 0 and wholesale_amount >= 0
           and commission_amount >= 0),
  constraint reseller_commissions_arithmetic_check
    check (commission_amount = retail_amount - wholesale_amount),
  constraint reseller_commissions_currency_check
    check (currency ~ '^[A-Z]{3}$'),
  constraint reseller_commissions_status_check
    check (status in ('pending', 'earned', 'paid', 'reversed', 'cancelled')),
  constraint reseller_commissions_earned_check
    check (status not in ('earned', 'paid') or earned_at is not null),
  constraint reseller_commissions_reversed_check
    check (status <> 'reversed' or reversed_at is not null)
);

comment on table public.reseller_commissions is
  'What a partner earned on one billing period of one account.';

create unique index reseller_commissions_invoice_unique
  on public.reseller_commissions (subscription_invoice_id)
  where subscription_invoice_id is not null;

create index reseller_commissions_reseller_idx
  on public.reseller_commissions (reseller_id, status, period_start desc);

create index reseller_commissions_payable_idx
  on public.reseller_commissions (reseller_id)
  where status = 'earned';

create table public.reseller_payouts (
  id uuid primary key default public.generate_uuid_v7(),
  reseller_id uuid not null,

  payout_reference text not null,
  period_start date not null,
  period_end date not null,

  gross_amount numeric(18, 4) not null default 0,
  fee_amount numeric(18, 4) not null default 0,
  net_amount numeric(18, 4) not null default 0,
  currency char(3) not null default 'USD',
  commission_count integer not null default 0,

  status text not null default 'draft',
  payout_method text,
  external_reference text,
  paid_at timestamptz,
  failure_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,

  constraint reseller_payouts_reference_check
    check (payout_reference ~ '^RP-[0-9]{4,10}$'),
  constraint reseller_payouts_period_check
    check (period_end >= period_start),
  constraint reseller_payouts_amounts_check
    check (gross_amount >= 0 and fee_amount >= 0 and net_amount >= 0),
  constraint reseller_payouts_arithmetic_check
    check (net_amount = gross_amount - fee_amount),
  constraint reseller_payouts_currency_check
    check (currency ~ '^[A-Z]{3}$'),
  constraint reseller_payouts_status_check
    check (status in ('draft', 'approved', 'processing', 'paid', 'failed',
                      'cancelled')),
  constraint reseller_payouts_paid_check
    check (status <> 'paid' or paid_at is not null),
  constraint reseller_payouts_count_check
    check (commission_count >= 0)
);

comment on table public.reseller_payouts is
  'One payment of accumulated commission to a white label partner.';

create unique index reseller_payouts_reference_unique
  on public.reseller_payouts (reseller_id, payout_reference);

create index reseller_payouts_status_idx
  on public.reseller_payouts (reseller_id, status, period_end desc);

-- -----------------------------------------------------------------------------
-- The partner's own domain
-- -----------------------------------------------------------------------------

-- A white label partner serves the product from their own address. The
-- records that have to exist for that to work are listed here so the
-- interface can check them rather than describe them.
create table public.reseller_domains (
  id uuid primary key default public.generate_uuid_v7(),
  reseller_id uuid not null,

  hostname text not null,
  purpose text not null default 'app',

  verification_token text not null,
  verification_method text not null default 'dns_txt',
  is_verified boolean not null default false,
  verified_at timestamptz,
  last_checked_at timestamptz,
  last_check_error text,

  certificate_issued_at timestamptz,
  certificate_expires_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,

  constraint reseller_domains_hostname_check
    check (hostname ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'),
  constraint reseller_domains_purpose_check
    check (purpose in ('app', 'marketing', 'short_link', 'mail')),
  constraint reseller_domains_method_check
    check (verification_method in ('dns_txt', 'dns_cname', 'http_file')),
  constraint reseller_domains_token_check
    check (length(verification_token) between 16 and 128),
  constraint reseller_domains_verified_check
    check (not is_verified or verified_at is not null)
);

comment on table public.reseller_domains is
  'An address a white label partner serves the product from.';

create unique index reseller_domains_hostname_unique
  on public.reseller_domains (hostname)
  where deleted_at is null;

create index reseller_domains_reseller_idx
  on public.reseller_domains (reseller_id, purpose)
  where deleted_at is null;
