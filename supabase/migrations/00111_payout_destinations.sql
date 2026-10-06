-- supabase/migrations/00111_payout_destinations.sql
-- Verified payout destinations. Account and wallet details are encrypted;
-- only display-safe metadata is retained in plaintext.

create table public.payout_destinations (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  destination_type text not null,
  display_name text not null,
  provider_key text not null,
  account_details_encrypted text not null,
  account_last_four text null,
  currency_code text not null default 'USD',
  status payout_destination_status not null default 'pending',
  is_default boolean not null default false,
  verified_at timestamptz null,
  disabled_at timestamptz null,
  created_by_user_id uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint payout_destinations_type_not_blank check (length(btrim(destination_type)) > 0),
  constraint payout_destinations_name_not_blank check (length(btrim(display_name)) > 0),
  constraint payout_destinations_provider_not_blank check (length(btrim(provider_key)) > 0),
  constraint payout_destinations_details_not_blank check (length(btrim(account_details_encrypted)) > 0),
  constraint payout_destinations_verified_fields_valid check (
    (status = 'verified' and verified_at is not null) or status <> 'verified'
  )
);

create unique index payout_destinations_company_name_key
  on public.payout_destinations (company_id, lower(display_name))
  where deleted_at is null;
create unique index payout_destinations_one_default_key
  on public.payout_destinations (company_id)
  where is_default = true and deleted_at is null;
create index payout_destinations_company_status_idx
  on public.payout_destinations (company_id, status)
  where deleted_at is null;

comment on table public.payout_destinations is
  'An encrypted, manually verified destination for company wallet payouts.';
