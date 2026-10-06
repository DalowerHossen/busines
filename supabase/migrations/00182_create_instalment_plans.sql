-- supabase/migrations/00182_create_instalment_plans.sql
-- Paying an invoice in parts, in house or through a buy now pay later partner.
--
-- Two arrangements share one shape. In a self financed plan the business
-- carries the balance and chases it. With a partner the business is paid at
-- once and the partner carries the risk, less a fee. The schedule looks the
-- same either way, which is what keeps the client facing screens simple.

create table public.instalment_offers (
  id uuid primary key default public.generate_uuid_v7(),
  -- Null is a platform wide offer tenants may switch on.
  company_id uuid,

  name text not null,
  provider text not null default 'self_financed',
  description text,

  instalment_count smallint not null,
  interval_unit text not null default 'month',
  interval_count smallint not null default 1,
  -- The share taken at checkout before the schedule begins.
  down_payment_percentage numeric(5, 2) not null default 0,

  interest_rate_percentage numeric(5, 2) not null default 0,
  partner_fee_percentage numeric(5, 2) not null default 0,
  late_fee_amount numeric(18, 4) not null default 0,
  grace_period_days smallint not null default 3,

  minimum_invoice_amount numeric(18, 4) not null default 0,
  maximum_invoice_amount numeric(18, 4),
  currency char(3) not null default 'USD',

  requires_approval boolean not null default false,
  is_active boolean not null default true,
  display_order smallint not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint instalment_offers_name_check
    check (length(btrim(name)) between 2 and 80),
  constraint instalment_offers_provider_check
    check (provider in ('self_financed', 'klarna', 'afterpay', 'affirm',
                        'zip', 'tabby', 'tamara', 'custom_partner')),
  constraint instalment_offers_count_check
    check (instalment_count between 2 and 60),
  constraint instalment_offers_interval_check
    check (interval_unit in ('week', 'month')),
  constraint instalment_offers_interval_count_check
    check (interval_count between 1 and 12),
  constraint instalment_offers_down_payment_check
    check (down_payment_percentage between 0 and 90),
  constraint instalment_offers_rate_check
    check (interest_rate_percentage between 0 and 100
           and partner_fee_percentage between 0 and 100),
  constraint instalment_offers_fee_check
    check (late_fee_amount >= 0 and grace_period_days between 0 and 60),
  constraint instalment_offers_amount_check
    check (minimum_invoice_amount >= 0
           and (maximum_invoice_amount is null
                or maximum_invoice_amount > minimum_invoice_amount)),
  constraint instalment_offers_currency_check
    check (currency ~ '^[A-Z]{3}$')
);

comment on table public.instalment_offers is
  'A way of paying in parts that a business offers on its invoices.';

create index instalment_offers_company_idx
  on public.instalment_offers (company_id, display_order)
  where is_active and deleted_at is null;

-- -----------------------------------------------------------------------------
-- An agreement on one invoice
-- -----------------------------------------------------------------------------

create table public.instalment_plans (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  invoice_id uuid not null,
  client_id uuid,
  offer_id uuid,

  plan_reference text not null,
  provider text not null default 'self_financed',

  total_amount numeric(18, 4) not null,
  down_payment_amount numeric(18, 4) not null default 0,
  financed_amount numeric(18, 4) not null,
  interest_amount numeric(18, 4) not null default 0,
  partner_fee_amount numeric(18, 4) not null default 0,
  -- What the business actually receives when a partner carries the balance.
  net_settlement_amount numeric(18, 4),
  currency char(3) not null default 'USD',

  instalment_count smallint not null,
  paid_count smallint not null default 0,
  paid_amount numeric(18, 4) not null default 0,
  outstanding_amount numeric(18, 4) not null,

  status text not null default 'pending',
  first_due_date date not null,
  final_due_date date not null,

  -- Partner side identity and settlement.
  provider_plan_reference text,
  provider_settled_at timestamptz,
  approval_decision text,
  approved_at timestamptz,
  declined_reason text,

  defaulted_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  completed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,

  constraint instalment_plans_reference_check
    check (plan_reference ~ '^IP-[0-9]{4,10}$'),
  constraint instalment_plans_amounts_check
    check (total_amount > 0 and down_payment_amount >= 0
           and financed_amount >= 0 and interest_amount >= 0
           and partner_fee_amount >= 0 and paid_amount >= 0
           and outstanding_amount >= 0),
  constraint instalment_plans_split_check
    check (down_payment_amount + financed_amount = total_amount),
  constraint instalment_plans_currency_check
    check (currency ~ '^[A-Z]{3}$'),
  constraint instalment_plans_count_check
    check (instalment_count between 2 and 60
           and paid_count between 0 and instalment_count),
  constraint instalment_plans_status_check
    check (status in ('pending', 'active', 'completed', 'defaulted',
                      'cancelled', 'declined')),
  constraint instalment_plans_dates_check
    check (final_due_date >= first_due_date),
  constraint instalment_plans_default_check
    check (status <> 'defaulted' or defaulted_at is not null),
  constraint instalment_plans_declined_check
    check (status <> 'declined' or declined_reason is not null),
  constraint instalment_plans_cancelled_check
    check (status <> 'cancelled' or cancellation_reason is not null)
);

comment on table public.instalment_plans is
  'An agreement to pay one invoice in parts, in house or through a partner.';

create unique index instalment_plans_reference_unique
  on public.instalment_plans (company_id, plan_reference);

create unique index instalment_plans_invoice_unique
  on public.instalment_plans (invoice_id)
  where status in ('pending', 'active');

create index instalment_plans_company_idx
  on public.instalment_plans (company_id, status, final_due_date);

-- -----------------------------------------------------------------------------
-- The schedule
-- -----------------------------------------------------------------------------

create table public.instalment_schedule_items (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  plan_id uuid not null,

  instalment_number smallint not null,
  due_date date not null,
  amount numeric(18, 4) not null,
  principal_amount numeric(18, 4) not null,
  interest_amount numeric(18, 4) not null default 0,

  status text not null default 'scheduled',
  paid_amount numeric(18, 4) not null default 0,
  paid_at timestamptz,
  payment_id uuid,

  late_fee_amount numeric(18, 4) not null default 0,
  reminder_sent_at timestamptz,
  retry_count smallint not null default 0,
  last_failure_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint instalment_schedule_items_number_check
    check (instalment_number between 1 and 60),
  constraint instalment_schedule_items_amount_check
    check (amount > 0 and principal_amount >= 0 and interest_amount >= 0
           and paid_amount >= 0 and late_fee_amount >= 0),
  constraint instalment_schedule_items_status_check
    check (status in ('scheduled', 'due', 'paid', 'partially_paid', 'overdue',
                      'failed', 'written_off', 'cancelled')),
  constraint instalment_schedule_items_paid_check
    check (status <> 'paid' or paid_at is not null),
  constraint instalment_schedule_items_retry_check
    check (retry_count between 0 and 10)
);

comment on table public.instalment_schedule_items is
  'One payment in an instalment plan, with what it is for and whether it came.';

create unique index instalment_schedule_items_unique
  on public.instalment_schedule_items (plan_id, instalment_number);

create index instalment_schedule_items_due_idx
  on public.instalment_schedule_items (due_date)
  where status in ('scheduled', 'due', 'overdue');
