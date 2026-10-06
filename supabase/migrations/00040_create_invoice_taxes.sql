-- supabase/migrations/00040_create_invoice_taxes.sql
-- The tax summary printed under the totals of a document.
--
-- A compliant invoice shows each rate separately with its taxable base and its
-- tax amount. The summary is rebuilt from the lines whenever the document
-- changes and is frozen with the document once it is issued.

create table public.invoice_taxes (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  invoice_id uuid not null,

  tax_rate_id uuid,
  tax_name text not null,
  tax_percentage numeric(9, 4) not null,
  is_compound boolean not null default false,

  taxable_amount numeric(18, 4) not null default 0,
  tax_amount numeric(18, 4) not null default 0,
  display_order smallint not null default 1,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint invoice_taxes_name_check
    check (length(btrim(tax_name)) between 1 and 80),
  constraint invoice_taxes_percentage_check
    check (tax_percentage >= 0 and tax_percentage <= 100),
  constraint invoice_taxes_amounts_check
    check (taxable_amount >= 0 and tax_amount >= 0)
);

comment on table public.invoice_taxes is
  'Per rate tax breakdown shown on the document and used by the tax reports.';

create unique index invoice_taxes_unique
  on public.invoice_taxes (invoice_id, tax_name, tax_percentage);

create index invoice_taxes_invoice_idx
  on public.invoice_taxes (invoice_id, display_order);

create index invoice_taxes_company_idx
  on public.invoice_taxes (company_id);

create index invoice_taxes_rate_idx
  on public.invoice_taxes (tax_rate_id)
  where tax_rate_id is not null;

-- -----------------------------------------------------------------------------
-- Document activity
-- -----------------------------------------------------------------------------

-- Everything that happens to a document from the recipient side. Together with
-- the stored consent records this is the evidence chain used to answer a
-- chargeback: what was sent, when it was opened and from where.
create table public.document_events (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,

  document_kind public.shared_document_type not null,
  document_id uuid not null,

  event_type public.document_event_type not null,
  actor_user_id uuid,
  recipient_email citext,

  ip_address inet,
  user_agent text,
  country_code char(2),
  referrer text,
  detail jsonb not null default '{}'::jsonb,

  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  constraint document_events_detail_check
    check (jsonb_typeof(detail) = 'object'),
  constraint document_events_country_check
    check (country_code is null or country_code ~ '^[A-Z]{2}$')
);

comment on table public.document_events is
  'Delivery and viewing evidence for every document shared with a client.';

create index document_events_document_idx
  on public.document_events (document_kind, document_id, occurred_at desc);

create index document_events_company_idx
  on public.document_events (company_id, occurred_at desc);

create index document_events_type_idx
  on public.document_events (company_id, event_type, occurred_at desc);

-- Document events are evidence and are never rewritten.
create trigger document_events_append_only
  before update or delete on public.document_events
  for each row execute function public.block_audit_mutation();
