-- supabase/migrations/00014_clients.sql
-- A client (customer) of a company. Clients never hold a platform account;
-- they are reached only through the tokenized links added later in this
-- migration group (see 00020_client_access_tokens.sql).
--
-- Billing and shipping addresses are flattened into individual columns
-- (matching the company_profiles convention from Phase 5) rather than
-- stored as jsonb, keeping address fields directly queryable/indexable.

create table public.clients (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  display_name text not null,
  company_name_on_invoice text null,
  email citext not null,
  phone text null,
  billing_address_line1 text null,
  billing_address_line2 text null,
  billing_city text null,
  billing_state text null,
  billing_postal_code text null,
  billing_country_code text null,
  shipping_address_line1 text null,
  shipping_address_line2 text null,
  shipping_city text null,
  shipping_state text null,
  shipping_postal_code text null,
  shipping_country_code text null,
  tax_id text null,
  default_currency_code text not null default 'USD',
  group_id uuid null references public.client_groups (id),
  -- Quick free-text note shown directly on the client record. Full,
  -- timestamped, authored notes live in client_notes instead.
  notes text null,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create index clients_company_id_idx on public.clients (company_id) where deleted_at is null;
create index clients_group_id_idx on public.clients (group_id) where group_id is not null;
create index clients_email_idx on public.clients (company_id, email);
create index clients_display_name_trgm_idx
  on public.clients using gin (display_name extensions.gin_trgm_ops)
  where deleted_at is null;

comment on table public.clients is
  'A company''s customer record. Clients never hold a platform account; they are reached only through tokenized access links.';
