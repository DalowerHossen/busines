-- supabase/migrations/00168_create_developer_apps.sql
-- The developer platform: third party apps, their grants and their tokens.
--
-- This is what Zapier, Make, a browser extension or a customer's own script
-- connect through. An app never holds a tenant password; it holds a grant
-- that an owner gave and can take back in one click.

create table public.developer_apps (
  id uuid primary key default public.generate_uuid_v7(),

  -- The tenant or partner who built it. Null means we built it.
  owner_company_id uuid,
  owner_reseller_id uuid,

  app_slug text not null,
  app_name text not null,
  tagline text,
  description text,
  logo_path text,
  homepage_url text,
  privacy_policy_url text,
  support_email citext,

  app_type text not null default 'oauth',
  distribution text not null default 'private',

  client_id text not null,
  client_secret_encrypted text,
  client_secret_hint text,
  secret_rotated_at timestamptz,
  previous_secret_encrypted text,
  previous_secret_expires_at timestamptz,

  requested_scopes text[] not null default array[]::text[],
  allowed_scopes text[] not null default array[]::text[],
  webhook_url text,
  webhook_secret_encrypted text,

  status text not null default 'draft',
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid,
  rejection_reason text,
  suspended_at timestamptz,
  suspension_reason text,

  install_count integer not null default 0,
  rate_limit_per_minute integer not null default 120,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint developer_apps_owner_check
    check (num_nonnulls(owner_company_id, owner_reseller_id) <= 1),
  constraint developer_apps_slug_check
    check (app_slug ~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$'),
  constraint developer_apps_name_check
    check (length(btrim(app_name)) between 2 and 60),
  constraint developer_apps_type_check
    check (app_type in ('oauth', 'api_key', 'extension', 'webhook_consumer')),
  constraint developer_apps_distribution_check
    check (distribution in ('private', 'unlisted', 'public')),
  constraint developer_apps_client_id_check
    check (client_id ~ '^app_[A-Za-z0-9_-]{16,64}$'),
  constraint developer_apps_hint_check
    check (client_secret_hint is null or length(client_secret_hint) <= 12),
  constraint developer_apps_status_check
    check (status in ('draft', 'in_review', 'approved', 'rejected',
                      'suspended', 'retired')),
  constraint developer_apps_approved_check
    check (status <> 'approved' or approved_at is not null),
  constraint developer_apps_rejected_check
    check (status <> 'rejected' or rejection_reason is not null),
  constraint developer_apps_public_check
    check (distribution <> 'public' or status in ('in_review', 'approved',
                                                  'suspended', 'retired')),
  constraint developer_apps_scopes_check
    check (cardinality(requested_scopes) <= 40
           and cardinality(allowed_scopes) <= 40),
  constraint developer_apps_rate_limit_check
    check (rate_limit_per_minute between 1 and 6000),
  constraint developer_apps_email_check
    check (support_email is null or public.is_valid_email(support_email::text))
);

comment on table public.developer_apps is
  'A third party application that connects to tenant data through the API.';

create unique index developer_apps_slug_unique
  on public.developer_apps (app_slug)
  where deleted_at is null;

create unique index developer_apps_client_id_unique
  on public.developer_apps (client_id);

create index developer_apps_directory_idx
  on public.developer_apps (distribution, status)
  where deleted_at is null;

-- Where an authorisation may be sent back to. Exact match, no wildcards.
create table public.developer_app_redirect_uris (
  id uuid primary key default public.generate_uuid_v7(),
  app_id uuid not null,

  redirect_uri text not null,
  environment text not null default 'production',
  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  created_by uuid,

  constraint developer_app_redirect_uris_scheme_check
    check (
      redirect_uri ~ '^https://[^\s?#]+$'
      or redirect_uri ~ '^http://localhost(:[0-9]{2,5})?(/[^\s?#]*)?$'
      or redirect_uri ~ '^[a-z][a-z0-9+.-]*://[^\s]+$'
    ),
  constraint developer_app_redirect_uris_length_check
    check (length(redirect_uri) between 8 and 500),
  constraint developer_app_redirect_uris_environment_check
    check (environment in ('production', 'development'))
);

comment on table public.developer_app_redirect_uris is
  'An exact address an authorisation code may be returned to.';

create unique index developer_app_redirect_uris_unique
  on public.developer_app_redirect_uris (app_id, redirect_uri);

-- -----------------------------------------------------------------------------
-- Grants: what a tenant allowed an app to do
-- -----------------------------------------------------------------------------

create table public.developer_app_installs (
  id uuid primary key default public.generate_uuid_v7(),
  app_id uuid not null,
  company_id uuid not null,

  granted_scopes text[] not null default array[]::text[],
  installed_by uuid,
  installed_at timestamptz not null default now(),

  status text not null default 'active',
  revoked_at timestamptz,
  revoked_by uuid,
  revocation_reason text,

  last_used_at timestamptz,
  last_used_ip inet,
  request_count bigint not null default 0,
  error_count bigint not null default 0,

  configuration jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint developer_app_installs_status_check
    check (status in ('active', 'revoked', 'suspended')),
  constraint developer_app_installs_revoked_check
    check (status <> 'revoked' or revoked_at is not null),
  constraint developer_app_installs_scopes_check
    check (cardinality(granted_scopes) between 1 and 40),
  constraint developer_app_installs_counts_check
    check (request_count >= 0 and error_count >= 0)
);

comment on table public.developer_app_installs is
  'The permission one tenant gave one application, and how it is being used.';

create unique index developer_app_installs_active_unique
  on public.developer_app_installs (app_id, company_id)
  where status <> 'revoked';

create index developer_app_installs_company_idx
  on public.developer_app_installs (company_id, status);

-- A single use code handed back through the redirect address.
create table public.developer_auth_codes (
  id uuid primary key default public.generate_uuid_v7(),
  app_id uuid not null,
  company_id uuid not null,
  user_id uuid,

  code_hash text not null,
  redirect_uri text not null,
  requested_scopes text[] not null,
  -- Proof key, because public clients cannot keep a secret.
  code_challenge text,
  code_challenge_method text,

  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),

  constraint developer_auth_codes_hash_check
    check (length(code_hash) = 64),
  constraint developer_auth_codes_challenge_check
    check (code_challenge_method is null
           or code_challenge_method in ('S256', 'plain')),
  constraint developer_auth_codes_scopes_check
    check (cardinality(requested_scopes) between 1 and 40)
);

comment on table public.developer_auth_codes is
  'A short lived single use authorisation code for an application.';

create unique index developer_auth_codes_hash_unique
  on public.developer_auth_codes (code_hash);

create index developer_auth_codes_expiry_idx
  on public.developer_auth_codes (expires_at)
  where consumed_at is null;

-- The tokens an app actually calls with.
create table public.developer_access_tokens (
  id uuid primary key default public.generate_uuid_v7(),
  install_id uuid not null,
  app_id uuid not null,
  company_id uuid not null,

  token_hash text not null,
  token_hint text not null,
  token_type text not null default 'access',
  scopes text[] not null,

  issued_at timestamptz not null default now(),
  expires_at timestamptz,
  last_used_at timestamptz,
  use_count bigint not null default 0,

  revoked_at timestamptz,
  revocation_reason text,
  replaced_by_token_id uuid,

  created_at timestamptz not null default now(),

  constraint developer_access_tokens_hash_check
    check (length(token_hash) = 64),
  constraint developer_access_tokens_hint_check
    check (length(token_hint) between 4 and 12),
  constraint developer_access_tokens_type_check
    check (token_type in ('access', 'refresh')),
  constraint developer_access_tokens_scopes_check
    check (cardinality(scopes) between 1 and 40),
  constraint developer_access_tokens_use_check
    check (use_count >= 0)
);

comment on table public.developer_access_tokens is
  'A hashed token an application presents on every API call.';

create unique index developer_access_tokens_hash_unique
  on public.developer_access_tokens (token_hash);

create index developer_access_tokens_install_idx
  on public.developer_access_tokens (install_id, token_type)
  where revoked_at is null;

-- -----------------------------------------------------------------------------
-- What the catalogue of automations offers
-- -----------------------------------------------------------------------------

-- The triggers and actions an app exposes, which is what a Zapier or Make
-- connector reads to build its own list.
create table public.developer_app_capabilities (
  id uuid primary key default public.generate_uuid_v7(),
  app_id uuid not null,

  capability_key text not null,
  capability_kind text not null,
  display_name text not null,
  description text,
  required_scope text not null,
  payload_schema jsonb not null default '{}'::jsonb,
  sample_payload jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  sort_order smallint not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint developer_app_capabilities_key_check
    check (capability_key ~ '^[a-z][a-z0-9_.]{2,60}$'),
  constraint developer_app_capabilities_kind_check
    check (capability_kind in ('trigger', 'action', 'search')),
  constraint developer_app_capabilities_name_check
    check (length(btrim(display_name)) between 3 and 80)
);

comment on table public.developer_app_capabilities is
  'A trigger, action or lookup an application advertises to automation tools.';

create unique index developer_app_capabilities_unique
  on public.developer_app_capabilities (app_id, capability_key);
