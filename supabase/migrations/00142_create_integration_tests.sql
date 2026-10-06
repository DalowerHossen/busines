-- supabase/migrations/00142_create_integration_tests.sql
-- Connection tests and the record of how a connection has behaved.
--
-- Nothing is switched on until it has been proved to work. The admin panel
-- runs a test against the provider before the save button does anything, and
-- the result is kept here so a failing integration can be explained rather
-- than guessed at.

create table public.integration_connection_tests (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid,
  credential_id uuid,
  provider_key text not null,
  environment text not null default 'live',

  succeeded boolean not null,
  duration_ms integer,
  status_code smallint,
  message text,
  -- Anything the provider said that helps a person fix it, with no secrets.
  diagnostics jsonb not null default '{}'::jsonb,

  tested_by uuid,
  tested_at timestamptz not null default now(),

  constraint integration_tests_provider_check
    check (provider_key ~ '^[a-z][a-z0-9_]{2,40}$'),
  constraint integration_tests_environment_check
    check (environment in ('live', 'test')),
  constraint integration_tests_duration_check
    check (duration_ms is null or duration_ms between 0 and 600000),
  constraint integration_tests_message_check
    check (message is null or length(btrim(message)) between 2 and 500),
  constraint integration_tests_diagnostics_check
    check (jsonb_typeof(diagnostics) = 'object')
);

comment on table public.integration_connection_tests is
  'Every connection test run against a provider, successful or not.';

create index integration_tests_credential_idx
  on public.integration_connection_tests (credential_id, tested_at desc);

create index integration_tests_company_idx
  on public.integration_connection_tests (company_id, tested_at desc);

create index integration_tests_failures_idx
  on public.integration_connection_tests (provider_key, tested_at desc)
  where not succeeded;

-- A test result may be added but never rewritten.
create trigger integration_connection_tests_10_append_only
  before update on public.integration_connection_tests
  for each row execute function public.block_audit_mutation();

-- -----------------------------------------------------------------------------
-- Using a connection
-- -----------------------------------------------------------------------------

-- Every call through an integration passes through here, so the settings
-- screen can say honestly when a connection last worked.
create table public.integration_usage_events (
  id uuid primary key default public.generate_uuid_v7(),
  company_id uuid,
  credential_id uuid,
  provider_key text not null,

  operation text not null,
  succeeded boolean not null,
  duration_ms integer,
  error_code text,
  error_message text,
  occurred_at timestamptz not null default now(),

  constraint integration_usage_provider_check
    check (provider_key ~ '^[a-z][a-z0-9_]{2,40}$'),
  constraint integration_usage_operation_check
    check (operation ~ '^[a-z][a-z0-9_.]{2,60}$'),
  constraint integration_usage_duration_check
    check (duration_ms is null or duration_ms between 0 and 600000)
);

comment on table public.integration_usage_events is
  'One call made through an integration, kept so failures can be explained.';

create index integration_usage_credential_idx
  on public.integration_usage_events (credential_id, occurred_at desc);

create index integration_usage_company_idx
  on public.integration_usage_events (company_id, occurred_at desc);

create index integration_usage_failures_idx
  on public.integration_usage_events (provider_key, occurred_at desc)
  where not succeeded;

create trigger integration_usage_events_10_append_only
  before update on public.integration_usage_events
  for each row execute function public.block_audit_mutation();
