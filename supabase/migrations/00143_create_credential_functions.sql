-- supabase/migrations/00143_create_credential_functions.sql
-- Saving, testing, switching on and rotating a connection.
--
-- Every routine here is the only supported way to change a credential, which
-- is what makes the rules enforceable: the right people, a successful test
-- before anything is switched on, and a grace window on every rotation.

-- Who is allowed to configure this level of this provider.
create or replace function public.can_configure_integration(
  p_company_id uuid,
  p_provider_key text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_scope text;
begin
  select configurable_by into v_scope
    from public.integration_providers
   where provider_key = p_provider_key and is_active;

  if v_scope is null then
    return false;
  end if;

  if p_company_id is null then
    return (v_scope in ('platform', 'both'))
       and (public.is_service_role() or public.is_super_admin());
  end if;

  return (v_scope in ('tenant', 'both'))
     and (public.is_service_role()
          or public.is_super_admin()
          or public.is_company_owner(p_company_id));
end;
$$;

comment on function public.can_configure_integration(uuid, text) is
  'Returns whether the caller may configure this provider at this level.';

-- Saves a credential. The application has already encrypted the bundle and
-- worked out the masked hints, so nothing secret passes through in the clear.
-- Saving never switches the connection on; that is a separate, tested step.
create or replace function public.save_integration_credential(
  p_company_id uuid,
  p_provider_key text,
  p_environment text,
  p_secret_bundle_encrypted text,
  p_bundle_fingerprint text default null,
  p_masked_hints jsonb default '{}'::jsonb,
  p_public_config jsonb default '{}'::jsonb,
  p_label text default null,
  p_key_version smallint default 1
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if not public.can_configure_integration(p_company_id, p_provider_key) then
    raise exception 'You cannot configure % here', p_provider_key
      using errcode = '42501';
  end if;

  if coalesce(p_environment, 'live') not in ('live', 'test') then
    raise exception 'A credential is either live or test' using errcode = '22023';
  end if;

  select id into v_id
    from public.integration_credentials
   where provider_key = p_provider_key
     and environment = coalesce(p_environment, 'live')
     and company_id is not distinct from p_company_id
     and deleted_at is null;

  if v_id is null then
    insert into public.integration_credentials (
      company_id, provider_key, environment, label,
      secret_bundle_encrypted, encryption_key_version, bundle_fingerprint,
      masked_hints, public_config, status
    )
    values (
      p_company_id, p_provider_key, coalesce(p_environment, 'live'), p_label,
      p_secret_bundle_encrypted, coalesce(p_key_version, 1::smallint),
      p_bundle_fingerprint, coalesce(p_masked_hints, '{}'::jsonb),
      coalesce(p_public_config, '{}'::jsonb), 'untested'
    )
    returning id into v_id;

    return v_id;
  end if;

  -- Changing the secret invalidates the last test, deliberately: the key that
  -- was proved to work is not the key that is there now.
  update public.integration_credentials
     set label = coalesce(p_label, label),
         secret_bundle_encrypted = coalesce(
           p_secret_bundle_encrypted, secret_bundle_encrypted
         ),
         encryption_key_version = coalesce(p_key_version, encryption_key_version),
         bundle_fingerprint = coalesce(p_bundle_fingerprint, bundle_fingerprint),
         masked_hints = coalesce(p_masked_hints, masked_hints),
         public_config = coalesce(p_public_config, public_config),
         status = case
           when p_secret_bundle_encrypted is null then status
           else 'untested'
         end,
         last_test_succeeded = case
           when p_secret_bundle_encrypted is null then last_test_succeeded
           else null
         end,
         is_enabled = case
           when p_secret_bundle_encrypted is null then is_enabled
           else false
         end,
         updated_at = now()
   where id = v_id;

  return v_id;
end;
$$;

comment on function public.save_integration_credential(
  uuid, text, text, text, text, jsonb, jsonb, text, smallint
) is 'Stores an encrypted credential bundle without switching the connection on.';

-- Records the outcome of a connection test.
create or replace function public.record_connection_test(
  p_credential_id uuid,
  p_succeeded boolean,
  p_message text default null,
  p_status_code smallint default null,
  p_duration_ms integer default null,
  p_diagnostics jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_credential public.integration_credentials%rowtype;
  v_test_id uuid;
begin
  select * into v_credential
    from public.integration_credentials
   where id = p_credential_id and deleted_at is null;

  if not found then
    raise exception 'That connection does not exist' using errcode = 'P0002';
  end if;

  if not public.can_configure_integration(
       v_credential.company_id, v_credential.provider_key
     ) then
    raise exception 'You cannot test this connection' using errcode = '42501';
  end if;

  insert into public.integration_connection_tests (
    company_id, credential_id, provider_key, environment, succeeded,
    duration_ms, status_code, message, diagnostics, tested_by
  )
  values (
    v_credential.company_id, p_credential_id, v_credential.provider_key,
    v_credential.environment, p_succeeded, p_duration_ms, p_status_code,
    p_message, coalesce(p_diagnostics, '{}'::jsonb), public.current_user_id()
  )
  returning id into v_test_id;

  update public.integration_credentials
     set last_tested_at = now(),
         last_test_succeeded = p_succeeded,
         status = case
           when p_succeeded and is_enabled then 'ready'
           when p_succeeded then 'untested'
           else 'failing'
         end,
         last_error = case when p_succeeded then last_error else p_message end,
         last_error_at = case when p_succeeded then last_error_at else now() end,
         updated_at = now()
   where id = p_credential_id;

  return v_test_id;
end;
$$;

comment on function public.record_connection_test(
  uuid, boolean, text, smallint, integer, jsonb
) is 'Stores the result of testing a connection against the provider.';

-- Switches a connection on. A provider that can be tested has to have been.
create or replace function public.enable_integration(p_credential_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_credential public.integration_credentials%rowtype;
  v_testable boolean;
begin
  select * into v_credential
    from public.integration_credentials
   where id = p_credential_id and deleted_at is null
     for update;

  if not found then
    raise exception 'That connection does not exist' using errcode = 'P0002';
  end if;

  if not public.can_configure_integration(
       v_credential.company_id, v_credential.provider_key
     ) then
    raise exception 'You cannot switch this connection on' using errcode = '42501';
  end if;

  select supports_connection_test into v_testable
    from public.integration_providers
   where provider_key = v_credential.provider_key;

  if coalesce(v_testable, false) and coalesce(v_credential.last_test_succeeded, false) = false then
    raise exception
      'Test the connection successfully before switching it on'
      using errcode = '22023';
  end if;

  update public.integration_credentials
     set is_enabled = true,
         status = 'ready',
         updated_at = now()
   where id = p_credential_id;

  return true;
end;
$$;

comment on function public.enable_integration(uuid) is
  'Switches a connection on, once it has been proved to work.';

-- Switches a connection off without losing its configuration.
create or replace function public.disable_integration(
  p_credential_id uuid,
  p_reason text default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_credential public.integration_credentials%rowtype;
begin
  select * into v_credential
    from public.integration_credentials
   where id = p_credential_id and deleted_at is null
     for update;

  if not found then
    return false;
  end if;

  if not public.can_configure_integration(
       v_credential.company_id, v_credential.provider_key
     ) then
    raise exception 'You cannot switch this connection off' using errcode = '42501';
  end if;

  update public.integration_credentials
     set is_enabled = false,
         status = 'disabled',
         last_error = coalesce(p_reason, last_error),
         updated_at = now()
   where id = p_credential_id;

  return true;
end;
$$;

comment on function public.disable_integration(uuid, text) is
  'Switches a connection off while keeping everything that was configured.';

-- Replaces the secret bundle and keeps the previous one valid briefly, so a
-- rotation never drops a request that was already on its way.
create or replace function public.rotate_integration_credential(
  p_credential_id uuid,
  p_new_bundle_encrypted text,
  p_new_fingerprint text default null,
  p_masked_hints jsonb default null,
  p_grace_minutes integer default 5
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_credential public.integration_credentials%rowtype;
begin
  select * into v_credential
    from public.integration_credentials
   where id = p_credential_id and deleted_at is null
     for update;

  if not found then
    raise exception 'That connection does not exist' using errcode = 'P0002';
  end if;

  if not public.can_configure_integration(
       v_credential.company_id, v_credential.provider_key
     ) then
    raise exception 'You cannot rotate this credential' using errcode = '42501';
  end if;

  if p_new_bundle_encrypted is null then
    raise exception 'A rotation needs a replacement bundle' using errcode = '22023';
  end if;

  update public.integration_credentials
     set previous_bundle_encrypted = secret_bundle_encrypted,
         previous_bundle_valid_until = now()
           + make_interval(mins => greatest(coalesce(p_grace_minutes, 5), 1)),
         secret_bundle_encrypted = p_new_bundle_encrypted,
         bundle_fingerprint = coalesce(p_new_fingerprint, bundle_fingerprint),
         masked_hints = coalesce(p_masked_hints, masked_hints),
         rotated_at = now(),
         rotated_by = public.current_user_id(),
         updated_at = now()
   where id = p_credential_id;

  return true;
end;
$$;

comment on function public.rotate_integration_credential(
  uuid, text, text, jsonb, integer
) is 'Replaces a credential and keeps the old one usable for a grace window.';

-- Clears the grace window once it has passed, so the old secret stops being
-- held at all.
create or replace function public.expire_credential_grace_windows()
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  update public.integration_credentials
     set previous_bundle_encrypted = null,
         previous_bundle_valid_until = null,
         updated_at = now()
   where previous_bundle_valid_until is not null
     and previous_bundle_valid_until <= now();

  get diagnostics v_count = row_count;

  return v_count;
end;
$$;

comment on function public.expire_credential_grace_windows() is
  'Drops a replaced credential once its grace window has closed.';

-- -----------------------------------------------------------------------------
-- Telling the truth about how a connection behaves
-- -----------------------------------------------------------------------------

-- Called after every call through an integration.
create or replace function public.record_integration_use(
  p_credential_id uuid,
  p_operation text,
  p_succeeded boolean,
  p_duration_ms integer default null,
  p_error_code text default null,
  p_error_message text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_credential public.integration_credentials%rowtype;
  v_event_id uuid;
begin
  select * into v_credential
    from public.integration_credentials
   where id = p_credential_id;

  if not found then
    return null;
  end if;

  insert into public.integration_usage_events (
    company_id, credential_id, provider_key, operation, succeeded,
    duration_ms, error_code, error_message
  )
  values (
    v_credential.company_id, p_credential_id, v_credential.provider_key,
    p_operation, p_succeeded, p_duration_ms, p_error_code,
    left(coalesce(p_error_message, ''), 500)
  )
  returning id into v_event_id;

  update public.integration_credentials
     set use_count = use_count + 1,
         last_used_at = now(),
         last_success_at = case when p_succeeded then now() else last_success_at end,
         last_error = case when p_succeeded then last_error else p_error_message end,
         last_error_at = case when p_succeeded then last_error_at else now() end,
         consecutive_failures = case
           when p_succeeded then 0
           else consecutive_failures + 1
         end,
         status = case
           when p_succeeded and is_enabled then 'ready'
           when not p_succeeded then 'failing'
           else status
         end,
         updated_at = now()
   where id = p_credential_id;

  return v_event_id;
end;
$$;

comment on function public.record_integration_use(
  uuid, text, boolean, integer, text, text
) is 'Records one call through an integration and how it went.';
