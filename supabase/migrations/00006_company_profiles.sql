-- supabase/migrations/00006_company_profiles.sql
-- The editable branding and billing profile for a company: logo, address,
-- tax id, default currency, invoice numbering prefix. Kept separate from
-- `companies` so core tenant identity (name, slug, owner, suspension) and
-- editable profile data can evolve independently, and so a frozen copy can
-- be taken per invoice without duplicating the whole companies row (see
-- company_profile_snapshots in the next migration).

create table public.company_profiles (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  logo_provider_file_id text null,
  address_line1 text null,
  address_line2 text null,
  city text null,
  state text null,
  postal_code text null,
  country_code text null,
  tax_id text null,
  contact_email citext null,
  contact_phone text null,
  website_url text null,
  default_currency_code text not null default 'USD',
  invoice_prefix text not null default 'INV',
  next_invoice_sequence integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index company_profiles_company_id_key on public.company_profiles (company_id);

comment on table public.company_profiles is
  'One-to-one editable branding/billing profile per company. A logo change here only affects invoices issued after the change, per the logo-on-new-invoices-only rule.';
comment on column public.company_profiles.next_invoice_sequence is
  'Advisory-lock-protected counter consumed by the invoice numbering function added in Phase 7, kept gapless per company.';
