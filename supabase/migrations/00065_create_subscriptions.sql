-- supabase/migrations/00065_create_subscriptions.sql
-- Tenant subscriptions to the platform.
--
-- Every company has exactly one live subscription. A new company starts on the
-- free plan, so the product always works before a card is ever entered, and a
-- paid plan that lapses falls back to free rather than locking the tenant out
-- of its own records.

create table public.subscriptions (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  plan_id uuid not null,
  plan_price_id uuid,

  status public.subscription_status not null default 'active',
  billing_interval public.billing_interval not null default 'monthly',
  currency char(3) not null default 'USD',
  amount numeric(18, 4) not null default 0,

  -- Period currently paid for.
  current_period_start date not null default current_date,
  current_period_end date not null default (current_date + 30),
  next_billing_date date,

  trial_start_date date,
  trial_end_date date,
  is_trial_used boolean not null default false,

  -- Cancellation is scheduled for the end of the paid period by default, so
  -- nobody loses days they already paid for.
  cancel_at_period_end boolean not null default false,
  cancelled_at timestamptz,
  cancellation_reason text,
  ended_at timestamptz,
  paused_at timestamptz,
  resumes_at date,

  -- Dunning state for a failed renewal.
  past_due_since date,
  dunning_attempt_count smallint not null default 0,
  last_dunning_email_at timestamptz,
  grace_period_ends_on date,

  -- Collection details.
  provider public.gateway_provider,
  provider_subscription_reference text,
  client_payment_method_id uuid,
  coupon_id uuid,
  discount_amount numeric(18, 4) not null default 0,

  -- Who sold it, when the platform pays a commission.
  affiliate_id uuid,
  reseller_id uuid,

  notes text,
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint subscriptions_currency_check
    check (currency ~ '^[A-Z]{3}$'),
  constraint subscriptions_amount_check
    check (amount >= 0 and discount_amount >= 0 and discount_amount <= amount),
  constraint subscriptions_period_check
    check (current_period_end >= current_period_start),
  constraint subscriptions_trial_check
    check (trial_end_date is null or trial_start_date is null
           or trial_end_date >= trial_start_date),
  constraint subscriptions_trial_status_check
    check (status <> 'trialing' or trial_end_date is not null),
  constraint subscriptions_cancelled_check
    check (status <> 'cancelled' or cancelled_at is not null),
  constraint subscriptions_dunning_check
    check (dunning_attempt_count between 0 and 20),
  constraint subscriptions_metadata_check
    check (jsonb_typeof(metadata) = 'object')
);

comment on table public.subscriptions is
  'The plan a company is on, with its period, trial and dunning state.';
comment on column public.subscriptions.cancel_at_period_end is
  'A cancellation takes effect when the paid period ends, not immediately.';

create unique index subscriptions_live_unique
  on public.subscriptions (company_id)
  where deleted_at is null and status <> 'cancelled' and status <> 'expired';

create index subscriptions_company_idx
  on public.subscriptions (company_id, status)
  where deleted_at is null;

create index subscriptions_renewal_idx
  on public.subscriptions (next_billing_date)
  where deleted_at is null and status in ('active', 'trialing', 'past_due');

create index subscriptions_trial_end_idx
  on public.subscriptions (trial_end_date)
  where deleted_at is null and status = 'trialing';

create index subscriptions_affiliate_idx
  on public.subscriptions (affiliate_id)
  where affiliate_id is not null and deleted_at is null;

create unique index subscriptions_provider_reference_unique
  on public.subscriptions (provider, provider_subscription_reference)
  where provider_subscription_reference is not null and deleted_at is null;

-- -----------------------------------------------------------------------------
-- Subscription history
-- -----------------------------------------------------------------------------

-- Every plan change is kept, which answers the two questions support is always
-- asked: what were they on at the time, and who changed it.
create table public.subscription_changes (
  id uuid primary key default public.generate_uuid_v7(),
  subscription_id uuid not null,
  company_id uuid not null,

  change_type text not null,
  from_plan_id uuid,
  to_plan_id uuid,
  from_amount numeric(18, 4),
  to_amount numeric(18, 4),
  proration_amount numeric(18, 4) not null default 0,
  effective_date date not null default current_date,

  reason text,
  changed_by uuid,
  created_at timestamptz not null default now(),

  constraint subscription_changes_type_check
    check (change_type in ('created', 'upgrade', 'downgrade', 'interval_change',
                           'trial_started', 'trial_ended', 'renewed', 'paused',
                           'resumed', 'cancelled', 'reactivated', 'expired'))
);

comment on table public.subscription_changes is
  'Append only history of every subscription movement and who caused it.';

create index subscription_changes_subscription_idx
  on public.subscription_changes (subscription_id, created_at desc);

create index subscription_changes_company_idx
  on public.subscription_changes (company_id, created_at desc);

create trigger subscription_changes_append_only
  before update or delete on public.subscription_changes
  for each row execute function public.block_audit_mutation();

-- -----------------------------------------------------------------------------
-- Platform invoices
-- -----------------------------------------------------------------------------

-- What the platform charges the tenant. These are deliberately separate from
-- the invoices a tenant sends to its own clients: different numbering,
-- different identity, different tax treatment.
create table public.subscription_invoices (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  subscription_id uuid,

  invoice_number text not null,
  status public.invoice_status not null default 'sent',
  description text,

  period_start date,
  period_end date,
  issue_date date not null default current_date,
  due_date date not null default current_date,

  currency char(3) not null default 'USD',
  subtotal_amount numeric(18, 4) not null default 0,
  discount_amount numeric(18, 4) not null default 0,
  tax_amount numeric(18, 4) not null default 0,
  total_amount numeric(18, 4) not null default 0,
  paid_amount numeric(18, 4) not null default 0,
  balance_due numeric(18, 4)
    generated always as (total_amount - paid_amount) stored,

  -- Fees collected as merchant of record during the period, itemised for the
  -- transparency statement.
  merchant_fee_amount numeric(18, 4) not null default 0,
  line_items jsonb not null default '[]'::jsonb,

  paid_at timestamptz,
  payment_id uuid,
  provider_invoice_reference text,
  pdf_storage_key text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint subscription_invoices_currency_check
    check (currency ~ '^[A-Z]{3}$'),
  constraint subscription_invoices_amounts_check
    check (subtotal_amount >= 0 and tax_amount >= 0 and total_amount >= 0
           and paid_amount >= 0 and discount_amount >= 0),
  constraint subscription_invoices_period_check
    check (period_end is null or period_start is null or period_end >= period_start),
  constraint subscription_invoices_lines_check
    check (jsonb_typeof(line_items) = 'array')
);

comment on table public.subscription_invoices is
  'Invoices the platform issues to its tenants for plans and collection fees.';

create unique index subscription_invoices_number_unique
  on public.subscription_invoices (invoice_number)
  where deleted_at is null;

create index subscription_invoices_company_idx
  on public.subscription_invoices (company_id, issue_date desc)
  where deleted_at is null;

create index subscription_invoices_unpaid_idx
  on public.subscription_invoices (due_date)
  where deleted_at is null and status <> 'paid';
