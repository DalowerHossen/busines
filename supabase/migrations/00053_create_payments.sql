-- supabase/migrations/00053_create_payments.sql
-- Received payments and how they are allocated to invoices.
--
-- A payment is money that arrived; an allocation says which invoice it paid.
-- Keeping the two apart lets one transfer settle several invoices, lets an
-- overpayment sit as credit, and makes reconciliation with a bank statement
-- straightforward.

create table public.payments (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  client_id uuid,

  payment_number text,
  status public.payment_status not null default 'succeeded',

  method_type public.payment_method_type not null default 'bank_transfer',
  provider public.gateway_provider not null default 'manual',
  gateway_id uuid,
  payment_intent_id uuid,
  client_payment_method_id uuid,

  -- Money received, in the currency the client paid in.
  amount numeric(18, 4) not null,
  amount_minor bigint not null default 0,
  currency char(3) not null,
  currency_exponent smallint not null default 2,
  exchange_rate numeric(18, 8) not null default 1,
  amount_in_base_currency numeric(18, 4) not null default 0,

  -- What the provider kept, so the net deposit can be reconciled.
  gateway_fee_amount numeric(18, 4) not null default 0,
  platform_fee_amount numeric(18, 4) not null default 0,
  net_amount numeric(18, 4)
    generated always as (amount - gateway_fee_amount - platform_fee_amount) stored,

  allocated_amount numeric(18, 4) not null default 0,
  refunded_amount numeric(18, 4) not null default 0,
  unallocated_amount numeric(18, 4)
    generated always as (amount - allocated_amount - refunded_amount) stored,

  received_at timestamptz not null default now(),
  value_date date,

  provider_payment_reference text,
  provider_balance_transaction_reference text,
  bank_reference text,
  cheque_number text,
  payer_name text,
  payer_email citext,
  payer_phone text,

  -- Manual payments are recorded by a person and can carry a receipt image.
  is_manual boolean not null default false,
  recorded_by uuid,
  proof_storage_key text,
  notes text,

  -- Risk and merchant of record handling.
  risk_level public.risk_level not null default 'low',
  hold_status public.payment_hold_status,
  held_until date,

  failure_code text,
  failure_message text,
  reconciled_at timestamptz,
  bank_transaction_id uuid,

  receipt_number text,
  receipt_sent_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint payments_amount_check
    check (amount > 0),
  constraint payments_currency_check
    check (currency ~ '^[A-Z]{3}$'),
  constraint payments_exchange_rate_check
    check (exchange_rate > 0),
  constraint payments_fee_check
    check (gateway_fee_amount >= 0 and platform_fee_amount >= 0
           and gateway_fee_amount + platform_fee_amount <= amount),
  constraint payments_allocation_check
    check (allocated_amount >= 0 and refunded_amount >= 0
           and allocated_amount + refunded_amount <= amount + 0.0001),
  constraint payments_metadata_check
    check (jsonb_typeof(metadata) = 'object'),
  constraint payments_hold_check
    check (hold_status is null or held_until is not null)
);

comment on table public.payments is
  'Every amount received, whether through a gateway or recorded by hand.';
comment on column public.payments.unallocated_amount is
  'Money received that has not yet been applied to an invoice.';
comment on column public.payments.net_amount is
  'Amount left after the provider and platform fees.';

create unique index payments_number_unique
  on public.payments (company_id, payment_number)
  where payment_number is not null and deleted_at is null;

create unique index payments_provider_reference_unique
  on public.payments (provider, provider_payment_reference)
  where provider_payment_reference is not null and deleted_at is null;

create unique index payments_company_scope_key
  on public.payments (id, company_id);

create index payments_company_idx
  on public.payments (company_id, received_at desc)
  where deleted_at is null;

create index payments_client_idx
  on public.payments (client_id, received_at desc)
  where deleted_at is null;

create index payments_status_idx
  on public.payments (company_id, status)
  where deleted_at is null;

create index payments_unreconciled_idx
  on public.payments (company_id, received_at)
  where deleted_at is null and reconciled_at is null;

-- -----------------------------------------------------------------------------
-- Allocations
-- -----------------------------------------------------------------------------

create table public.payment_allocations (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  payment_id uuid not null,
  invoice_id uuid not null,

  amount numeric(18, 4) not null,
  allocated_at timestamptz not null default now(),
  reversed_at timestamptz,
  reversal_reason text,
  note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,

  constraint payment_allocations_amount_check
    check (amount > 0)
);

comment on table public.payment_allocations is
  'Links an amount received to the invoice it settles.';

create index payment_allocations_payment_idx
  on public.payment_allocations (payment_id)
  where reversed_at is null;

create index payment_allocations_invoice_idx
  on public.payment_allocations (invoice_id)
  where reversed_at is null;

create index payment_allocations_company_idx
  on public.payment_allocations (company_id, allocated_at desc);

-- -----------------------------------------------------------------------------
-- Payment receipts
-- -----------------------------------------------------------------------------

-- A receipt is the document the client receives once money has been applied.
-- It is numbered separately from invoices because many jurisdictions require
-- a continuous receipt sequence of its own.
create table public.payment_receipts (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  payment_id uuid not null,
  client_id uuid,

  receipt_number text not null,
  issue_date date not null default current_date,
  amount numeric(18, 4) not null,
  currency char(3) not null,

  company_profile_snapshot_id uuid,
  pdf_storage_key text,
  pdf_generated_at timestamptz,
  sent_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint payment_receipts_amount_check
    check (amount > 0),
  constraint payment_receipts_currency_check
    check (currency ~ '^[A-Z]{3}$')
);

comment on table public.payment_receipts is
  'Numbered receipts issued to clients for the payments they made.';

create unique index payment_receipts_number_unique
  on public.payment_receipts (company_id, receipt_number)
  where deleted_at is null;

create index payment_receipts_payment_idx
  on public.payment_receipts (payment_id)
  where deleted_at is null;

create index payment_receipts_company_idx
  on public.payment_receipts (company_id, issue_date desc)
  where deleted_at is null;
