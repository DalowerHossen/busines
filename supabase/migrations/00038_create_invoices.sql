-- supabase/migrations/00038_create_invoices.sql
-- Invoices, deposit invoices and proforma invoices.
--
-- An issued invoice is a legal record. Everything that is printed on it is
-- frozen onto the row at the moment it is issued: the business identity
-- snapshot, the client address, the currency, the exchange rate and the tax
-- treatment. Later edits to the company profile, the client or the catalogue
-- never change a document that has already left the building.

create table public.invoices (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  client_id uuid not null,
  client_contact_id uuid,

  document_type public.document_type not null default 'invoice',
  status public.invoice_status not null default 'draft',

  -- Assigned when the invoice is issued, never before, so drafts cannot
  -- consume a number they may never use.
  invoice_number text,

  -- Frozen business identity and client details.
  company_profile_snapshot_id uuid,
  bill_to jsonb not null default '{}'::jsonb,
  ship_to jsonb,
  client_name_snapshot text,
  client_tax_id_snapshot text,

  -- Money context.
  currency char(3) not null,
  currency_exponent smallint not null default 2,
  base_currency char(3) not null,
  exchange_rate numeric(18, 8) not null default 1,
  decimal_scale smallint not null default 2,
  rounding_mode public.rounding_mode not null default 'half_up',
  tax_mode public.tax_mode not null default 'exclusive',
  discount_stage public.discount_stage not null default 'before_tax',

  -- Dates. The supply date drives the tax point, which can differ from the
  -- issue date in several jurisdictions.
  issue_date date not null default current_date,
  supply_date date,
  due_date date not null default current_date,
  payment_terms_days smallint,

  -- Document level discount applied on top of the line discounts.
  discount_type public.discount_type,
  discount_value numeric(18, 4) not null default 0,

  shipping_amount numeric(18, 4) not null default 0,
  shipping_tax_rate_id uuid,

  -- Totals, all expressed in the document currency and maintained by
  -- public.recalculate_invoice_totals.
  subtotal_amount numeric(18, 4) not null default 0,
  line_discount_amount numeric(18, 4) not null default 0,
  document_discount_amount numeric(18, 4) not null default 0,
  taxable_amount numeric(18, 4) not null default 0,
  tax_amount numeric(18, 4) not null default 0,
  rounding_adjustment numeric(18, 4) not null default 0,
  total_amount numeric(18, 4) not null default 0,
  total_amount_minor bigint not null default 0,
  total_in_base_currency numeric(18, 4) not null default 0,

  paid_amount numeric(18, 4) not null default 0,
  credited_amount numeric(18, 4) not null default 0,
  balance_due numeric(18, 4)
    generated always as (total_amount - paid_amount - credited_amount) stored,

  -- International tax handling.
  applies_reverse_charge boolean not null default false,
  tax_note text,
  place_of_supply_country char(2),

  -- Presentation and references.
  purchase_order_reference text,
  project_reference text,
  notes text,
  terms_and_conditions text,
  footer_note text,
  internal_memo text,
  template_key text not null default 'classic',
  accent_color text,

  -- Lifecycle timestamps and delivery evidence.
  issued_at timestamptz,
  sent_at timestamptz,
  first_viewed_at timestamptz,
  last_viewed_at timestamptz,
  view_count integer not null default 0,
  paid_at timestamptz,
  written_off_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  disputed_at timestamptz,

  -- Collections.
  last_reminder_sent_at timestamptz,
  reminder_count smallint not null default 0,
  next_reminder_at timestamptz,
  promise_to_pay_date date,

  -- Immutability. A locked invoice can only change through a credit note or a
  -- revision, which keeps the audit trail honest.
  is_locked boolean not null default false,
  locked_at timestamptz,
  revision_of_invoice_id uuid,
  revision_number smallint not null default 0,

  -- Archived rendering, produced once at send time.
  pdf_storage_key text,
  pdf_generated_at timestamptz,
  pdf_sha256 text,

  recurring_schedule_id uuid,
  source_estimate_id uuid,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint invoices_document_type_check
    check (document_type in ('invoice', 'deposit_invoice', 'proforma_invoice')),
  constraint invoices_number_check
    check (invoice_number is null or length(btrim(invoice_number)) between 1 and 40),
  constraint invoices_issued_number_check
    check (status = 'draft' or invoice_number is not null),
  constraint invoices_currency_check
    check (currency ~ '^[A-Z]{3}$' and base_currency ~ '^[A-Z]{3}$'),
  constraint invoices_exchange_rate_check
    check (exchange_rate > 0),
  constraint invoices_exponent_check
    check (currency_exponent between 0 and 4 and decimal_scale between 0 and 4),
  constraint invoices_due_date_check
    check (due_date >= issue_date),
  constraint invoices_discount_value_check
    check (discount_value >= 0),
  constraint invoices_amounts_check
    check (
      subtotal_amount >= 0
      and line_discount_amount >= 0
      and document_discount_amount >= 0
      and tax_amount >= 0
      and shipping_amount >= 0
      and total_amount >= 0
      and paid_amount >= 0
      and credited_amount >= 0
    ),
  constraint invoices_settlement_check
    check (paid_amount + credited_amount <= total_amount + 0.0001),
  constraint invoices_bill_to_check
    check (jsonb_typeof(bill_to) = 'object'),
  constraint invoices_pdf_hash_check
    check (pdf_sha256 is null or pdf_sha256 ~ '^[0-9a-f]{64}$'),
  constraint invoices_cancellation_check
    check (status <> 'cancelled' or cancelled_at is not null),
  constraint invoices_place_of_supply_check
    check (place_of_supply_country is null or place_of_supply_country ~ '^[A-Z]{2}$'),
  constraint invoices_accent_color_check
    check (accent_color is null or accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint invoices_self_revision_check
    check (revision_of_invoice_id is distinct from id)
);

comment on table public.invoices is
  'Issued and draft invoices with the frozen identity and totals of each document.';
comment on column public.invoices.balance_due is
  'Outstanding amount, derived from the total less payments and credit notes.';
comment on column public.invoices.is_locked is
  'Set when the document is issued; a locked invoice is corrected, never edited.';
comment on column public.invoices.total_amount_minor is
  'Total expressed in the smallest unit of the currency, used by the gateways.';

create unique index invoices_number_unique
  on public.invoices (company_id, invoice_number)
  where invoice_number is not null and deleted_at is null;

create unique index invoices_company_scope_key
  on public.invoices (id, company_id);

create index invoices_company_status_idx
  on public.invoices (company_id, status, issue_date desc)
  where deleted_at is null;

create index invoices_client_idx
  on public.invoices (client_id, issue_date desc)
  where deleted_at is null;

create index invoices_due_idx
  on public.invoices (company_id, due_date)
  where deleted_at is null and status in ('sent', 'viewed', 'partially_paid', 'overdue');

create index invoices_reminder_idx
  on public.invoices (next_reminder_at)
  where deleted_at is null and next_reminder_at is not null;

create index invoices_number_trgm_idx
  on public.invoices using gin (invoice_number extensions.gin_trgm_ops);

create index invoices_schedule_idx
  on public.invoices (recurring_schedule_id)
  where recurring_schedule_id is not null;
