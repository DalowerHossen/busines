-- supabase/migrations/00031_estimates.sql
-- An estimate/quote, convertible into an invoice once approved. Mirrors
-- the invoices table's frozen-at-issue-time snapshot pattern from Phase 7.
-- converted_to_invoice_id has a real foreign key (invoices already exists
-- by this phase); it is nullable because most estimates stay estimates.

create type estimate_status as enum (
  'draft',
  'sent',
  'viewed',
  'approved',
  'declined',
  'expired'
);

create table public.estimates (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  client_id uuid not null references public.clients (id),
  estimate_number text not null,
  status estimate_status not null default 'draft',
  company_profile_snapshot_id uuid not null references public.company_profile_snapshots (id),
  client_snapshot_display_name text not null,
  client_snapshot_email citext not null,
  client_snapshot_billing_address_line1 text null,
  client_snapshot_billing_address_line2 text null,
  client_snapshot_billing_city text null,
  client_snapshot_billing_state text null,
  client_snapshot_billing_postal_code text null,
  client_snapshot_billing_country_code text null,
  issue_date date not null default current_date,
  expiry_date date null,
  currency_code text not null default 'USD',
  subtotal_amount numeric(14, 2) not null default 0,
  tax_total_amount numeric(14, 2) not null default 0,
  discount_total_amount numeric(14, 2) not null default 0,
  total_amount numeric(14, 2) not null default 0,
  notes text null,
  converted_to_invoice_id uuid null references public.invoices (id),
  created_by_user_id uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create unique index estimates_company_estimate_number_key
  on public.estimates (company_id, estimate_number)
  where deleted_at is null;
create index estimates_company_id_idx on public.estimates (company_id) where deleted_at is null;
create index estimates_client_id_idx on public.estimates (client_id);
create index estimates_status_idx on public.estimates (company_id, status) where deleted_at is null;

comment on table public.estimates is
  'A quote/estimate, convertible into an invoice once approved. Client and company-branding details are frozen at issue time, same as invoices.';
