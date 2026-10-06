-- supabase/migrations/00135_api_keys.sql
-- General public API keys. Only prefixes and one-way hashes are stored;
-- scopes are checked server-side and later enforced by RLS/API middleware.

create type api_key_status as enum (
  'active',
  'revoked',
  'expired'
);

create table public.api_keys (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  label text not null,
  key_prefix text not null,
  key_hash text not null,
  scopes text[] not null default '{}',
  status api_key_status not null default 'active',
  last_used_at timestamptz null,
  expires_at timestamptz null,
  revoked_at timestamptz null,
  created_by_user_id uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint api_keys_label_not_blank check (length(btrim(label)) > 0),
  constraint api_keys_prefix_not_blank check (length(btrim(key_prefix)) > 0),
  constraint api_keys_hash_not_blank check (length(btrim(key_hash)) > 0),
  constraint api_keys_revoked_date_valid check (revoked_at is null or status = 'revoked')
);

create unique index api_keys_prefix_key
  on public.api_keys (key_prefix)
  where deleted_at is null;
create unique index api_keys_company_label_key
  on public.api_keys (company_id, lower(label))
  where deleted_at is null;
create index api_keys_company_status_idx
  on public.api_keys (company_id, status)
  where deleted_at is null;

comment on table public.api_keys is
  'A tenant public API credential represented by a safe prefix and one-way hash.';
