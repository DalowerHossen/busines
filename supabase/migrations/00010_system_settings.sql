-- supabase/migrations/00010_system_settings.sql
-- Generic key-value settings store implementing the project's
-- DB-value -> env-var -> hardcoded-default resolution order. Used for
-- things like the global platform fee percentage, hold-period days, payout
-- SLA hours, and the 3DS/card-payment toggles, each overridable per
-- company by adding a row with that company_id.

create table public.system_settings (
  id uuid primary key default extensions.gen_random_uuid(),
  scope text not null,
  company_id uuid null references public.companies (id),
  key text not null,
  -- Non-secret values (feature toggles, numeric limits, JSON config).
  value_plain jsonb null,
  -- AES-256 ciphertext for secret values (API keys, provider tokens).
  -- Encrypted/decrypted only in trusted server code using ENCRYPTION_KEY,
  -- which per project rule is never rotated.
  value_encrypted text null,
  is_secret boolean not null default false,
  updated_by_user_id uuid null references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint system_settings_scope_valid check (scope in ('platform', 'company')),
  constraint system_settings_scope_company_match check (
    (scope = 'platform' and company_id is null)
    or (scope = 'company' and company_id is not null)
  ),
  constraint system_settings_value_shape check (
    (is_secret and value_encrypted is not null and value_plain is null)
    or (not is_secret and value_plain is not null and value_encrypted is null)
  )
);

-- Two partial unique indexes instead of one multi-column UNIQUE: a plain
-- UNIQUE (scope, company_id, key) would not dedupe platform rows because
-- company_id is NULL there and SQL NULLs never compare equal.
create unique index system_settings_platform_key
  on public.system_settings (key)
  where scope = 'platform';
create unique index system_settings_company_key
  on public.system_settings (company_id, key)
  where scope = 'company';

comment on table public.system_settings is
  'Key-value settings resolved as: company-scoped row -> platform-scoped row -> environment variable -> hardcoded default.';
