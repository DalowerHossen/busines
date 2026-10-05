-- supabase/migrations/00023_invoices.sql
-- The core invoice record. invoice_number is unique per company (not
-- globally); see 00028_invoice_numbering_function.sql for how a gapless
-- number is produced.
--
-- client_snapshot_* and company_profile_snapshot_id together implement the
-- frozen-at-issue-time rule: a later edit to the live client record or the
-- company's branding must never change a previously issued invoice.
-- company_profile_snapshot_id points at the immutable row created in
-- company_profile_snapshots (Phase 5); the client snapshot is flattened
-- directly onto this table instead of its own table, since (unlike a
-- company profile, which is reused unchanged across many invoices between
-- edits) a client snapshot is realistically unique to its one invoice and
-- a separate table would mostly hold single-use rows.
--
-- template_id has NO foreign key yet: invoice_templates does not exist
-- until Phase 8. It is a plain uuid here and Phase 8 adds the constraint.

create type invoice_status as enum (
  'draft',
  'sent',
  'viewed',
  'partially_paid',
  'paid',
  'overdue',
  'void'
);

create table public.invoices (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  client_id uuid not null references public.clients (id),
  invoice_number text not null,
  status invoice_status not null default 'draft',
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
  due_date date not null,
  currency_code text not null default 'USD',
  subtotal_amount numeric(14, 2) not null default 0,
  tax_total_amount numeric(14, 2) not null default 0,
  discount_total_amount numeric(14, 2) not null default 0,
  total_amount numeric(14, 2) not null default 0,
  amount_paid numeric(14, 2) not null default 0,
  amount_due numeric(14, 2) not null default 0,
  notes text null,
  internal_notes text null,
  template_id uuid null,
  created_by_user_id uuid not null references public.users (id),
  sent_at timestamptz null,
  first_viewed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create unique index invoices_company_invoice_number_key
  on public.invoices (company_id, invoice_number)
  where deleted_at is null;
create index invoices_company_id_idx on public.invoices (company_id) where deleted_at is null;
create index invoices_client_id_idx on public.invoices (client_id);
create index invoices_status_idx on public.invoices (company_id, status) where deleted_at is null;
create index invoices_due_date_idx
  on public.invoices (due_date)
  where status not in ('paid', 'void') and deleted_at is null;

comment on table public.invoices is
  'The core invoice record. Client and company-branding details are frozen at issue time via snapshot columns/FKs, independent of later edits to the live client or company profile.';
comment on column public.invoices.template_id is
  'References invoice_templates(id), added as a real foreign key once Phase 8 creates that table. Validated at the application layer until then.';
