-- supabase/migrations/00165_email_suppressions.sql
-- Deliverability suppression records use an HMAC/hash for lookup and an
-- encrypted address only when a trusted server process needs to display it.
-- Plaintext email addresses are never stored in this table.

create type email_suppression_reason as enum (
  'hard_bounce',
  'complaint',
  'provider_suppressed',
  'manual'
);

create table public.email_suppressions (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid null references public.companies (id),
  address_hash text not null,
  address_encrypted text null,
  reason email_suppression_reason not null,
  provider_event_id text null,
  is_active boolean not null default true,
  suppressed_at timestamptz not null default now(),
  lifted_at timestamptz null,
  created_by_user_id uuid null references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint email_suppressions_hash_not_blank check (length(btrim(address_hash)) >= 64),
  constraint email_suppressions_event_not_blank check (
    provider_event_id is null or length(btrim(provider_event_id)) > 0
  ),
  constraint email_suppressions_lifted_fields_valid check (
    (is_active and lifted_at is null) or (not is_active and lifted_at is not null)
  )
);

create unique index email_suppressions_active_address_key
  on public.email_suppressions (coalesce(company_id, '00000000-0000-0000-0000-000000000000'::uuid), address_hash)
  where is_active = true;
create unique index email_suppressions_provider_event_key
  on public.email_suppressions (provider_event_id)
  where provider_event_id is not null;
create index email_suppressions_lookup_idx
  on public.email_suppressions (company_id, address_hash)
  where is_active = true;

comment on table public.email_suppressions is
  'A hard-bounce, complaint, provider-suppressed, or manually blocked address. The lookup hash is deterministic HMAC output; the address itself is encrypted or absent.';
