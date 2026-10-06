-- supabase/migrations/00100_direct_checkout_api_key_pairs.sql
-- Merchant API key pairs for hosted/direct checkout. Only prefixes and
-- one-way hashes are stored; plaintext keys are shown once at provisioning.

create table public.direct_checkout_api_key_pairs (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  environment direct_checkout_environment not null,
  label text not null,
  publishable_key_prefix text not null,
  publishable_key_hash text not null,
  secret_key_prefix text not null,
  secret_key_hash text not null,
  allowed_origins text[] not null default '{}',
  status direct_checkout_key_status not null default 'active',
  last_used_at timestamptz null,
  expires_at timestamptz null,
  revoked_at timestamptz null,
  created_by_user_id uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint direct_checkout_api_key_pairs_label_not_blank check (length(btrim(label)) > 0),
  constraint direct_checkout_api_key_pairs_publishable_prefix_not_blank check (
    length(btrim(publishable_key_prefix)) > 0
  ),
  constraint direct_checkout_api_key_pairs_secret_prefix_not_blank check (
    length(btrim(secret_key_prefix)) > 0
  ),
  constraint direct_checkout_api_key_pairs_hashes_not_blank check (
    length(btrim(publishable_key_hash)) > 0 and length(btrim(secret_key_hash)) > 0
  ),
  constraint direct_checkout_api_key_pairs_revocation_date_valid check (
    revoked_at is null or status = 'revoked'
  )
);

create unique index direct_checkout_api_key_pairs_company_label_key
  on public.direct_checkout_api_key_pairs (company_id, environment, lower(label))
  where deleted_at is null;
create unique index direct_checkout_api_key_pairs_publishable_prefix_key
  on public.direct_checkout_api_key_pairs (publishable_key_prefix)
  where deleted_at is null;
create unique index direct_checkout_api_key_pairs_secret_prefix_key
  on public.direct_checkout_api_key_pairs (secret_key_prefix)
  where deleted_at is null;
create index direct_checkout_api_key_pairs_company_status_idx
  on public.direct_checkout_api_key_pairs (company_id, environment, status)
  where deleted_at is null;

comment on table public.direct_checkout_api_key_pairs is
  'A merchant publishable/secret API key pair represented by prefixes and one-way hashes, never plaintext secrets.';
