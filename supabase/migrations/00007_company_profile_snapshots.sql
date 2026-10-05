-- supabase/migrations/00007_company_profile_snapshots.sql
-- An immutable copy of a company's profile at the exact moment an invoice
-- or estimate was issued. The `invoices` table (added in Phase 7) stores a
-- `company_profile_snapshot_id` pointing at a row here, so a later change
-- to the company's logo or address never alters a previously sent
-- document. Snapshot rows are write-once: no updated_at, no soft delete.

create table public.company_profile_snapshots (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  company_name text not null,
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
  created_at timestamptz not null default now()
);

create index company_profile_snapshots_company_id_idx
  on public.company_profile_snapshots (company_id);

comment on table public.company_profile_snapshots is
  'Immutable, write-once copy of a company profile taken at invoice/estimate issue time. Never updated after creation.';
