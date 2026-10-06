-- supabase/migrations/00234_create_system_settings.sql
-- The encrypted secret and override store.
--
-- Resolution order for any configurable value is: company scoped row ->
-- platform scoped row -> environment variable -> hardcoded default. Secret
-- values are stored as ciphertext produced by the server side key vault and
-- are never readable by a browser session, so no policy grants access to
-- `authenticated`; only the service role reaches this table.

create table public.system_settings (
  id uuid primary key default public.generate_uuid_v7(),

  scope text not null,
  company_id uuid references public.companies (id),
  key text not null,

  -- Non secret values such as feature toggles and numeric limits.
  value_plain jsonb,
  -- Ciphertext for secret values such as provider API keys.
  value_encrypted text,
  is_secret boolean not null default false,

  updated_by_user_id uuid references public.users (id),
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

-- Two partial unique indexes rather than one composite unique constraint: a
-- plain unique (scope, company_id, key) would not deduplicate platform rows,
-- because company_id is null there and SQL nulls never compare equal.
create unique index system_settings_platform_key
  on public.system_settings (key)
  where scope = 'platform';
create unique index system_settings_company_key
  on public.system_settings (company_id, key)
  where scope = 'company';

comment on table public.system_settings is
  'Key value settings and encrypted secrets resolved as company row, platform row, environment variable, hardcoded default.';

select public.install_timestamp_trigger('system_settings');

alter table public.system_settings enable row level security;
alter table public.system_settings force row level security;

revoke all privileges on table public.system_settings from public, anon, authenticated;
