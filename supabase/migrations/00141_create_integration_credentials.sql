-- supabase/migrations/00141_create_integration_credentials.sql
-- The credential vault.
--
-- Two rules govern this table. First, the database never sees a secret in the
-- clear: the application encrypts the bundle with AES-256 before it arrives
-- and decrypts it after it leaves, so a database backup leaks nothing usable.
-- Second, a credential is resolved at runtime in the order database, then
-- environment variable, then built in default, which is why changing a key in
-- the admin panel takes effect without a rebuild or a redeployment.
--
-- A row with no company belongs to the platform. A row with a company belongs
-- to that tenant and overrides the platform one for that tenant only.

create table public.integration_credentials (
  id uuid primary key default public.generate_uuid_v7(),

  -- Null for the platform wide credential, set for a tenant override.
  company_id uuid,
  provider_key text not null,
  environment text not null default 'live',
  label text,

  -- The encrypted bundle of every secret field, as one envelope.
  secret_bundle_encrypted text,
  encryption_key_version smallint not null default 1,
  bundle_fingerprint text,
  -- What the interface shows instead of the secret, for example
  -- {"secret_key": "****4242"}. Never enough to use.
  masked_hints jsonb not null default '{}'::jsonb,
  -- The fields that are not secret and may be read by the interface.
  public_config jsonb not null default '{}'::jsonb,

  -- Rotation keeps the previous bundle valid for a few minutes, so requests
  -- already in flight are never dropped halfway through a deployment.
  previous_bundle_encrypted text,
  previous_bundle_valid_until timestamptz,
  rotated_at timestamptz,
  rotated_by uuid,

  is_enabled boolean not null default false,
  status text not null default 'unconfigured',

  last_tested_at timestamptz,
  last_test_succeeded boolean,
  last_used_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  last_error_at timestamptz,
  consecutive_failures smallint not null default 0,
  use_count bigint not null default 0,

  -- Bumped on every change. The application polls it so a credential change
  -- reaches every running instance within seconds rather than on restart.
  config_version integer not null default 1,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,

  constraint integration_credentials_provider_check
    check (provider_key ~ '^[a-z][a-z0-9_]{2,40}$'),
  constraint integration_credentials_environment_check
    check (environment in ('live', 'test')),
  constraint integration_credentials_status_check
    check (status in ('unconfigured', 'untested', 'ready', 'failing', 'disabled')),
  constraint integration_credentials_fingerprint_check
    check (bundle_fingerprint is null or bundle_fingerprint ~ '^[0-9a-f]{64}$'),
  constraint integration_credentials_hints_check
    check (jsonb_typeof(masked_hints) = 'object'
           and jsonb_typeof(public_config) = 'object'),
  constraint integration_credentials_label_check
    check (label is null or length(btrim(label)) between 2 and 80),
  -- A connection cannot be switched on before it has something to connect with.
  constraint integration_credentials_enabled_check
    check (not is_enabled or secret_bundle_encrypted is not null
           or public_config <> '{}'::jsonb),
  constraint integration_credentials_rotation_check
    check (previous_bundle_encrypted is null
           or previous_bundle_valid_until is not null),
  constraint integration_credentials_failures_check
    check (consecutive_failures >= 0 and use_count >= 0),
  constraint integration_credentials_version_check
    check (config_version >= 1)
);

comment on table public.integration_credentials is
  'Encrypted credentials for each connected service, changeable while running.';

comment on column public.integration_credentials.secret_bundle_encrypted is
  'AES-256 ciphertext produced by the application. The database never holds the key.';

comment on column public.integration_credentials.config_version is
  'Increases on every change so running instances notice within seconds.';

-- One credential per provider and environment, at each level.
create unique index integration_credentials_platform_key
  on public.integration_credentials (provider_key, environment)
  where company_id is null and deleted_at is null;

create unique index integration_credentials_tenant_key
  on public.integration_credentials (company_id, provider_key, environment)
  where company_id is not null and deleted_at is null;

create index integration_credentials_company_idx
  on public.integration_credentials (company_id, provider_key)
  where deleted_at is null;

create index integration_credentials_active_idx
  on public.integration_credentials (provider_key, environment)
  where is_enabled and deleted_at is null;

create index integration_credentials_grace_idx
  on public.integration_credentials (previous_bundle_valid_until)
  where previous_bundle_valid_until is not null;

create index integration_credentials_failing_idx
  on public.integration_credentials (last_error_at desc)
  where status = 'failing' and deleted_at is null;

-- -----------------------------------------------------------------------------
-- Knowing when something changed
-- -----------------------------------------------------------------------------

-- One row the application can read cheaply to decide whether its cached
-- credentials are still current. Polling this is a single indexed read.
create table public.integration_config_stamp (
  id boolean primary key default true,
  revision bigint not null default 1,
  changed_at timestamptz not null default now(),

  constraint integration_config_stamp_single_row check (id)
);

comment on table public.integration_config_stamp is
  'A single counter that moves whenever any credential changes.';

insert into public.integration_config_stamp (id) values (true);

-- Moves the counter. Called from the trigger on every credential write.
create or replace function public.bump_integration_revision()
returns bigint
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  update public.integration_config_stamp
     set revision = revision + 1,
         changed_at = now()
   where id
  returning revision;
$$;

comment on function public.bump_integration_revision() is
  'Moves the configuration counter so running instances refresh their cache.';

-- What an instance polls: the counter and when it last moved.
create or replace function public.integration_revision()
returns table (revision bigint, changed_at timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select s.revision, s.changed_at from public.integration_config_stamp as s where s.id;
$$;

comment on function public.integration_revision() is
  'Returns the current credential revision, for cache invalidation.';
