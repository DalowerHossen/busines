-- supabase/migrations/00040_saved_payment_methods.sql
-- A tokenized, saved payment method reference (for example a gateway
-- "payment_method" id). PCI SAQ-A scope: no raw card number, CVV, or
-- expiry is ever stored here or anywhere in this codebase, only the
-- gateway-issued token and display-safe metadata (last 4 digits, brand,
-- expiry month/year -- all of which a receipt is allowed to show).

create table public.saved_payment_methods (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  client_id uuid not null references public.clients (id),
  gateway gateway_id not null,
  gateway_token text not null,
  card_brand text null,
  card_last_four_digits text null,
  expiry_month smallint null,
  expiry_year smallint null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create index saved_payment_methods_client_id_idx
  on public.saved_payment_methods (client_id)
  where deleted_at is null;
create index saved_payment_methods_company_id_idx on public.saved_payment_methods (company_id);
-- At most one default saved payment method per client.
create unique index saved_payment_methods_one_default_per_client
  on public.saved_payment_methods (client_id)
  where is_default = true and deleted_at is null;

comment on table public.saved_payment_methods is
  'A tokenized, saved payment method reference. Never stores raw card data (PCI SAQ-A scope) -- only a gateway-issued token and display-safe metadata.';
