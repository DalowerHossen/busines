-- supabase/migrations/00096_ecommerce_orders.sql
-- An order imported from a connected store. Customer fields are snapshotted
-- so later store edits cannot change the order or its generated invoice.

create table public.ecommerce_orders (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  connection_id uuid not null references public.ecommerce_connections (id),
  client_id uuid null references public.clients (id),
  invoice_id uuid null references public.invoices (id),
  payment_id uuid null references public.payments (id),
  external_order_id text not null,
  external_order_number text null,
  status ecommerce_order_status not null default 'pending',
  external_financial_status text null,
  external_fulfillment_status text null,
  customer_name text null,
  customer_email citext null,
  customer_phone text null,
  billing_address jsonb null,
  shipping_address jsonb null,
  currency_code text not null default 'USD',
  subtotal_amount numeric(18, 4) not null default 0,
  discount_amount numeric(18, 4) not null default 0,
  shipping_amount numeric(18, 4) not null default 0,
  tax_amount numeric(18, 4) not null default 0,
  total_amount numeric(18, 4) not null default 0,
  raw_payload jsonb not null default '{}'::jsonb,
  external_created_at timestamptz null,
  external_updated_at timestamptz null,
  invoice_generated_at timestamptz null,
  invoice_emailed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint ecommerce_orders_external_id_not_blank check (length(btrim(external_order_id)) > 0),
  constraint ecommerce_orders_amounts_non_negative check (
    subtotal_amount >= 0 and discount_amount >= 0 and shipping_amount >= 0
    and tax_amount >= 0 and total_amount >= 0
  ),
  constraint ecommerce_orders_total_non_negative check (total_amount >= 0),
  constraint ecommerce_orders_billing_address_object check (
    billing_address is null or jsonb_typeof(billing_address) = 'object'
  ),
  constraint ecommerce_orders_shipping_address_object check (
    shipping_address is null or jsonb_typeof(shipping_address) = 'object'
  ),
  constraint ecommerce_orders_raw_payload_object check (jsonb_typeof(raw_payload) = 'object')
);

create unique index ecommerce_orders_connection_external_id_key
  on public.ecommerce_orders (connection_id, external_order_id)
  where deleted_at is null;
create index ecommerce_orders_company_id_idx
  on public.ecommerce_orders (company_id)
  where deleted_at is null;
create index ecommerce_orders_status_idx
  on public.ecommerce_orders (company_id, status, created_at desc)
  where deleted_at is null;
create index ecommerce_orders_client_id_idx
  on public.ecommerce_orders (client_id)
  where client_id is not null and deleted_at is null;
create index ecommerce_orders_invoice_id_idx
  on public.ecommerce_orders (invoice_id)
  where invoice_id is not null;

comment on table public.ecommerce_orders is
  'A tenant order imported from an external store with customer, amount, invoice, and payment linkage.';
