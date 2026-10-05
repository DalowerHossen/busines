-- supabase/migrations/00056_tax_rates.sql
-- A configurable tax rate an owner can apply to invoice/estimate line
-- items (R4.1 tax rate management, R4.2 compound/multi-tax, R4.3 US state
-- sales tax). Line items reference a tax rate as a percent snapshot at the
-- application layer (invoice_line_items.tax_rate_percent from Phase 7 is
-- already a plain numeric, not a foreign key, so an invoice's tax amount
-- never changes if the owner later edits or removes this rate).

create table public.tax_rates (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  name text not null,
  rate_percent numeric(5, 2) not null,
  country_code text null,
  state_code text null,
  is_compound boolean not null default false,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create index tax_rates_company_id_idx on public.tax_rates (company_id) where deleted_at is null;
-- At most one default tax rate per company.
create unique index tax_rates_one_default_per_company
  on public.tax_rates (company_id)
  where is_default = true and deleted_at is null;

comment on table public.tax_rates is
  'A configurable tax rate. Applied to invoice/estimate line items as a point-in-time percent snapshot, not a live foreign key.';
