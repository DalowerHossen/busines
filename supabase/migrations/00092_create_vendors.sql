-- supabase/migrations/00092_create_vendors.sql
-- Suppliers, and the people to talk to at each one.
--
-- A vendor mirrors a client: the same tenancy rules, the same soft delete, the
-- same duplicate detection. Keeping the shapes alike means the reports, the
-- import tool and the search behave the same way on both sides of the ledger.

create table public.vendors (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,

  vendor_reference text not null,
  display_name text not null,
  legal_name text,
  vendor_type public.client_type not null default 'business',
  status public.client_status not null default 'active',

  email citext,
  phone text,
  website text,

  address_line1 text,
  address_line2 text,
  city text,
  state_region text,
  postal_code text,
  country_code char(2),

  tax_number text,
  tax_rate_id uuid,
  -- Set when the supplier is in another country and the reverse charge applies.
  applies_reverse_charge boolean not null default false,

  currency char(3),
  payment_terms_days smallint not null default 30,
  default_expense_account_id uuid,

  -- Reporting totals, maintained by the bill and expense routines.
  total_billed numeric(18, 4) not null default 0,
  total_paid numeric(18, 4) not null default 0,
  outstanding_balance numeric(18, 4) not null default 0,

  -- Needed by the yearly contractor filings in the United States.
  is_1099_contractor boolean not null default false,
  tax_form_reference text,

  notes text,
  normalized_name text,
  normalized_email citext,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint vendors_reference_check
    check (vendor_reference ~ '^[A-Za-z0-9][A-Za-z0-9._/-]{1,31}$'),
  constraint vendors_name_check
    check (length(btrim(display_name)) between 2 and 120),
  constraint vendors_email_check
    check (email is null or public.is_valid_email(email::text)),
  constraint vendors_country_check
    check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  constraint vendors_currency_check
    check (currency is null or currency ~ '^[A-Z]{3}$'),
  constraint vendors_terms_check
    check (payment_terms_days between 0 and 365),
  constraint vendors_totals_check
    check (total_billed >= 0 and total_paid >= 0)
);

comment on table public.vendors is
  'Suppliers a tenant buys from, with the terms and account they post to.';

create unique index vendors_reference_unique
  on public.vendors (company_id, vendor_reference)
  where deleted_at is null;

create index vendors_company_idx
  on public.vendors (company_id, display_name)
  where deleted_at is null;

create index vendors_normalized_name_idx
  on public.vendors using gin (normalized_name extensions.gin_trgm_ops)
  where deleted_at is null;

create index vendors_email_idx
  on public.vendors (company_id, normalized_email)
  where normalized_email is not null and deleted_at is null;

-- -----------------------------------------------------------------------------
-- Contacts
-- -----------------------------------------------------------------------------

create table public.vendor_contacts (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid not null,
  vendor_id uuid not null,

  full_name text not null,
  job_title text,
  email citext,
  phone text,
  is_primary boolean not null default false,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint vendor_contacts_name_check
    check (length(btrim(full_name)) between 2 and 120),
  constraint vendor_contacts_email_check
    check (email is null or public.is_valid_email(email::text))
);

comment on table public.vendor_contacts is
  'The people a tenant deals with at each supplier.';

create unique index vendor_contacts_primary_unique
  on public.vendor_contacts (vendor_id)
  where is_primary and deleted_at is null;

create index vendor_contacts_vendor_idx
  on public.vendor_contacts (vendor_id)
  where deleted_at is null;

-- -----------------------------------------------------------------------------
-- Housekeeping
-- -----------------------------------------------------------------------------

-- Keeps the normalised columns that duplicate detection relies on.
create or replace function public.set_vendor_normalized_columns()
returns trigger
language plpgsql
set search_path = public, extensions, pg_temp
as $$
begin
  new.normalized_name := nullif(
    btrim(regexp_replace(lower(extensions.unaccent(coalesce(new.display_name, ''))),
                         '[^a-z0-9]+', ' ', 'g')),
    ''
  );
  new.normalized_email := nullif(lower(btrim(coalesce(new.email::text, ''))), '')::citext;

  return new;
end;
$$;

comment on function public.set_vendor_normalized_columns() is
  'Maintains the normalised name and address used to spot duplicates.';

-- Allocates the next reference in the per tenant supplier sequence.
create or replace function public.assign_vendor_reference()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_next integer;
begin
  if new.vendor_reference is not null and length(btrim(new.vendor_reference)) > 0 then
    return new;
  end if;

  select coalesce(
           max(nullif(regexp_replace(vendor_reference, '^VN-', ''), '')::integer),
           0
         ) + 1
    into v_next
    from public.vendors
   where company_id = new.company_id
     and vendor_reference ~ '^VN-[0-9]+$';

  new.vendor_reference := 'VN-' || lpad(v_next::text, 4, '0');

  return new;
end;
$$;

comment on function public.assign_vendor_reference() is
  'Gives a new supplier the next reference in the sequence of its tenant.';

-- Keeps the primary contact unique within a supplier.
create or replace function public.guard_primary_vendor_contact()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.is_primary then
    update public.vendor_contacts
       set is_primary = false,
           updated_at = now()
     where vendor_id = new.vendor_id
       and id <> new.id
       and is_primary
       and deleted_at is null;
  end if;

  return new;
end;
$$;

comment on function public.guard_primary_vendor_contact() is
  'Keeps a single primary contact for each supplier.';
