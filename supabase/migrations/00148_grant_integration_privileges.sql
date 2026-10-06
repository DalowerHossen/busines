-- supabase/migrations/00148_grant_integration_privileges.sql
-- Table, column and routine privileges for the credential vault.
--
-- The encrypted bundle is never granted to a signed in caller. Not the owner,
-- not the platform team through the browser: only the server side of the
-- application, which holds the decryption key, can ask for it, and it does so
-- through the resolver. What the interface gets is the masked hint.

grant select on public.integration_providers to authenticated;
grant insert, update on public.integration_providers to authenticated;

grant select (
  id, company_id, provider_key, environment, label, encryption_key_version,
  bundle_fingerprint, masked_hints, public_config, previous_bundle_valid_until,
  rotated_at, rotated_by, is_enabled, status, last_tested_at,
  last_test_succeeded, last_used_at, last_success_at, last_error, last_error_at,
  consecutive_failures, use_count, config_version, created_at, updated_at,
  deleted_at, created_by, updated_by
) on public.integration_credentials to authenticated;

-- Writing happens through the routines below, which enforce the rules. The
-- direct update grant exists only so an owner can archive a connection.
grant update (deleted_at, updated_at, updated_by)
  on public.integration_credentials to authenticated;

grant select on public.integration_connection_tests to authenticated;
grant select on public.integration_usage_events to authenticated;
grant select on public.integration_config_stamp to authenticated;

-- -----------------------------------------------------------------------------
-- Reading the catalogue
-- -----------------------------------------------------------------------------

grant execute on function public.integration_fields(text) to authenticated;
grant execute on function public.integration_revision() to authenticated;
grant execute on function public.can_configure_integration(uuid, text)
  to authenticated;
grant execute on function public.integration_is_available(uuid, text, text)
  to authenticated;
grant execute on function public.integration_overview(uuid) to authenticated;
grant execute on function public.failing_integrations(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Changing a connection
-- -----------------------------------------------------------------------------

grant execute on function public.save_integration_credential(
  uuid, text, text, text, text, jsonb, jsonb, text, smallint
) to authenticated;
grant execute on function public.record_connection_test(
  uuid, boolean, text, smallint, integer, jsonb
) to authenticated;
grant execute on function public.enable_integration(uuid) to authenticated;
grant execute on function public.disable_integration(uuid, text) to authenticated;
grant execute on function public.rotate_integration_credential(
  uuid, text, text, jsonb, integer
) to authenticated;

-- -----------------------------------------------------------------------------
-- Server side only
-- -----------------------------------------------------------------------------

-- The resolver hands back ciphertext and the usage recorder is called from
-- the integration layer, so both belong to the service role alone. The
-- default grant PostgreSQL gives to everybody is withdrawn as well.
revoke execute on function public.resolve_integration(uuid, text, text)
  from public, authenticated;
revoke execute on function public.record_integration_use(
  uuid, text, boolean, integer, text, text
) from public, authenticated;
revoke execute on function public.expire_credential_grace_windows()
  from public, authenticated;
revoke execute on function public.bump_integration_revision()
  from public, authenticated;

grant execute on function public.resolve_integration(uuid, text, text)
  to service_role;
grant execute on function public.record_integration_use(
  uuid, text, boolean, integer, text, text
) to service_role;
grant execute on function public.expire_credential_grace_windows()
  to service_role;
grant execute on function public.bump_integration_revision() to service_role;
