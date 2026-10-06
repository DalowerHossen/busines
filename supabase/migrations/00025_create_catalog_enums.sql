-- supabase/migrations/00025_create_catalog_enums.sql
-- Enumerated types used by the client directory and the product catalogue.

create type public.client_type as enum (
  'individual',
  'business'
);

create type public.client_status as enum (
  'active',
  'inactive',
  'archived'
);

create type public.address_type as enum (
  'billing',
  'shipping'
);

-- A product line can be stock, a service, a digital download, a recurring plan
-- or a billable expense that is passed on to the client.
create type public.product_type as enum (
  'goods',
  'service',
  'digital',
  'subscription',
  'billable_expense'
);

create type public.product_status as enum (
  'active',
  'inactive',
  'archived'
);

-- The statutory family a rate belongs to, printed on the document and used by
-- the tax reports.
create type public.tax_rate_kind as enum (
  'vat',
  'gst',
  'sales_tax',
  'service_tax',
  'withholding',
  'other'
);

-- How a price list derives the price a client actually pays.
create type public.price_list_method as enum (
  'fixed_price',
  'discount_percentage',
  'markup_percentage'
);

-- The record type a saved view or a tag applies to.
create type public.taggable_entity as enum (
  'client',
  'product',
  'invoice',
  'estimate',
  'expense',
  'project'
);
