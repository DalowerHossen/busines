-- supabase/migrations/00139_grant_platform_privileges.sql
-- Table, column and routine privileges for platform operations.
--
-- The digest of an API key and the encrypted secret of a webhook endpoint are
-- deliberately left out of the column grants. A signed in caller can manage a
-- key or an endpoint without ever being able to read the secret behind it.

grant select (
  id, company_id, name, description, key_prefix, status, environment, scopes,
  allowed_ip_ranges, allowed_origins, rate_limit_per_minute, rate_limit_per_day,
  last_used_at, last_used_ip_hash, request_count, expires_at, revoked_at,
  revoked_by, revoke_reason, rotated_from_key_id, grace_expires_at,
  created_at, updated_at, deleted_at, created_by, updated_by
) on public.api_keys to authenticated;

grant insert on public.api_keys to authenticated;

-- The digest is written once, when the key is issued, and can never be
-- overwritten by hand afterwards.
grant update (
  name, description, scopes, status, allowed_ip_ranges, allowed_origins,
  rate_limit_per_minute, rate_limit_per_day, expires_at, deleted_at,
  updated_at, updated_by
) on public.api_keys to authenticated;

grant select on public.api_request_logs to authenticated;

grant select (
  id, company_id, name, target_url, description, signing_secret_fingerprint,
  secret_key_version, previous_secret_valid_until, subscribed_events,
  is_active, api_version, max_attempts, timeout_seconds, consecutive_failures,
  disabled_at, disabled_reason, last_success_at, last_failure_at,
  last_status_code, created_at, updated_at, deleted_at, created_by, updated_by
) on public.webhook_endpoints to authenticated;

grant insert on public.webhook_endpoints to authenticated;

-- A signing secret is replaced through the rotation routine, which keeps the
-- old one valid for a moment, so it is not updatable directly either.
grant update (
  name, target_url, description, subscribed_events, is_active, api_version,
  max_attempts, timeout_seconds, disabled_at, disabled_reason, deleted_at,
  updated_at, updated_by
) on public.webhook_endpoints to authenticated;

grant select on public.outbound_events to authenticated;
grant select on public.webhook_deliveries to authenticated;

grant select on public.background_jobs to authenticated;
grant select, insert, update on public.job_schedules to authenticated;

grant select on public.platform_settings to authenticated;
grant update on public.platform_settings to authenticated;
grant select, insert, update on public.feature_flags to authenticated;

grant select, update on public.tenant_security_policies to authenticated;

grant select, insert, update on public.approval_requests to authenticated;
grant select on public.approval_decisions to authenticated;
grant select on public.sensitive_access_logs to authenticated;

-- -----------------------------------------------------------------------------
-- API key routines
-- -----------------------------------------------------------------------------

grant execute on function public.api_key_has_scope(uuid, text) to authenticated;
grant execute on function public.rotate_api_key(uuid, text, text, integer)
  to authenticated;
grant execute on function public.revoke_api_key(uuid, text) to authenticated;

-- Authenticating and metering a key happens before any user context exists,
-- so those routines belong to the service role alone. The default grant that
-- PostgreSQL gives to everybody is taken away as well, otherwise the revoke
-- below would be decorative.
revoke execute on function public.authenticate_api_key(text) from public, authenticated;
revoke execute on function public.touch_api_key(uuid, text) from public, authenticated;
revoke execute on function public.expire_stale_api_keys() from public, authenticated;

-- -----------------------------------------------------------------------------
-- Traffic routines
-- -----------------------------------------------------------------------------

grant execute on function public.api_usage_summary(uuid, timestamptz, timestamptz)
  to authenticated;
grant execute on function public.rate_limit_status(text, text, integer)
  to authenticated;

revoke execute on function public.consume_rate_limit(text, text, integer, integer)
  from public, authenticated;
revoke execute on function public.prune_rate_limit_counters(integer)
  from public, authenticated;
revoke execute on function public.record_api_request(
  uuid, uuid, text, text, smallint, integer, text, text, text, text, text, boolean
) from public, authenticated;

-- -----------------------------------------------------------------------------
-- Webhook routines
-- -----------------------------------------------------------------------------

grant execute on function public.emit_outbound_event(
  uuid, text, text, uuid, jsonb, text
) to authenticated;
grant execute on function public.replay_webhook_delivery(uuid) to authenticated;
grant execute on function public.rotate_webhook_secret(uuid, text, text, integer)
  to authenticated;
grant execute on function public.webhook_dead_letters(uuid, integer)
  to authenticated;

-- Delivery workers run as the service role.
revoke execute on function public.claim_webhook_deliveries(text, integer)
  from public, authenticated;
revoke execute on function public.record_webhook_attempt(
  uuid, smallint, integer, text, text
) from public, authenticated;

-- -----------------------------------------------------------------------------
-- Job routines
-- -----------------------------------------------------------------------------

grant execute on function public.enqueue_job(
  text, jsonb, uuid, timestamptz, text, smallint, text, smallint
) to authenticated;
grant execute on function public.job_queue_health() to authenticated;

revoke execute on function public.claim_jobs(text, text, integer, integer)
  from public, authenticated;
revoke execute on function public.start_job(uuid) from public, authenticated;
revoke execute on function public.complete_job(uuid, jsonb) from public, authenticated;
revoke execute on function public.fail_job(uuid, text, boolean) from public, authenticated;
revoke execute on function public.release_expired_job_leases() from public, authenticated;
revoke execute on function public.dispatch_due_schedules() from public, authenticated;
revoke execute on function public.retry_dead_job(uuid) from public, authenticated;

-- -----------------------------------------------------------------------------
-- Settings, flags and policy routines
-- -----------------------------------------------------------------------------

grant execute on function public.platform_setting(text) to authenticated;
grant execute on function public.feature_flag_enabled(text, uuid) to authenticated;
grant execute on function public.ip_is_allowed(uuid, inet) to authenticated;
grant execute on function public.requires_second_approval(uuid, text, numeric)
  to authenticated;
grant execute on function public.staff_action_within_cap(uuid, uuid, numeric)
  to authenticated;

-- The routine itself refuses anybody who is not on the platform team, so the
-- grant can be open.
grant execute on function public.set_platform_setting(text, jsonb)
  to authenticated;

-- -----------------------------------------------------------------------------
-- Approval routines
-- -----------------------------------------------------------------------------

grant execute on function public.request_approval(
  uuid, text, text, jsonb, numeric, char, text, uuid, text, smallint, integer
) to authenticated;
grant execute on function public.decide_approval(uuid, text, text, text)
  to authenticated;
grant execute on function public.complete_approved_action(uuid, jsonb)
  to authenticated;
grant execute on function public.record_sensitive_access(
  uuid, text, uuid, text, text, text, text
) to authenticated;
grant execute on function public.sensitive_access_report(
  uuid, timestamptz, timestamptz
) to authenticated;

revoke execute on function public.expire_stale_approvals() from public, authenticated;

-- -----------------------------------------------------------------------------
-- The routines the workers run
-- -----------------------------------------------------------------------------

-- These were taken away from everybody above, so the service role, which is
-- what the queue runner and the API edge sign in as, is given them back here
-- and nowhere else.
grant execute on function public.authenticate_api_key(text) to service_role;
grant execute on function public.touch_api_key(uuid, text) to service_role;
grant execute on function public.expire_stale_api_keys() to service_role;
grant execute on function public.consume_rate_limit(text, text, integer, integer)
  to service_role;
grant execute on function public.prune_rate_limit_counters(integer) to service_role;
grant execute on function public.record_api_request(
  uuid, uuid, text, text, smallint, integer, text, text, text, text, text, boolean
) to service_role;
grant execute on function public.claim_webhook_deliveries(text, integer)
  to service_role;
grant execute on function public.record_webhook_attempt(
  uuid, smallint, integer, text, text
) to service_role;
grant execute on function public.claim_jobs(text, text, integer, integer)
  to service_role;
grant execute on function public.start_job(uuid) to service_role;
grant execute on function public.complete_job(uuid, jsonb) to service_role;
grant execute on function public.fail_job(uuid, text, boolean) to service_role;
grant execute on function public.release_expired_job_leases() to service_role;
grant execute on function public.dispatch_due_schedules() to service_role;
grant execute on function public.retry_dead_job(uuid) to service_role;
grant execute on function public.expire_stale_approvals() to service_role;
