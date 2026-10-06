-- supabase/migrations/00125_grant_storage_privileges.sql
-- Table and routine privileges for storage, uploads and contracts.

grant select, insert, update on public.storage_targets to authenticated;
grant select, insert, update on public.files to authenticated;
grant select, insert on public.file_variants to authenticated;
grant select, insert on public.file_access_logs to authenticated;
grant select, insert, update on public.upload_sessions to authenticated;
grant select on public.storage_quotas to authenticated;

grant select, insert, update on public.contracts to authenticated;
grant select, insert, update on public.contract_templates to authenticated;
grant select, insert, update on public.contract_signers to authenticated;
grant select, insert on public.contract_events to authenticated;

-- -----------------------------------------------------------------------------
-- Storage routines
-- -----------------------------------------------------------------------------

grant execute on function public.resolve_storage_target(uuid) to authenticated;
grant execute on function public.build_storage_key(uuid, text, text)
  to authenticated;
grant execute on function public.begin_upload_session(
  uuid, text, text, bigint, text, text, uuid, boolean
) to authenticated;
grant execute on function public.complete_upload_session(uuid, bigint, text)
  to authenticated;
grant execute on function public.abort_upload_session(uuid, text) to authenticated;

grant execute on function public.storage_quota_bytes(uuid) to authenticated;
grant execute on function public.storage_quota_allows(uuid, bigint)
  to authenticated;
grant execute on function public.recalculate_storage_usage(uuid) to authenticated;
grant execute on function public.storage_usage_report(uuid) to authenticated;

grant execute on function public.attach_file(uuid, text, uuid) to authenticated;
grant execute on function public.create_file_version(uuid, text, text, bigint, text)
  to authenticated;
grant execute on function public.record_file_access(
  uuid, text, uuid, text, text, boolean, text
) to authenticated;
grant execute on function public.purge_file(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Contract routines
-- -----------------------------------------------------------------------------

grant execute on function public.record_contract_event(
  uuid, text, text, uuid, text, text, jsonb
) to authenticated;
grant execute on function public.send_contract(uuid, date) to authenticated;
grant execute on function public.view_contract(uuid, text, text) to authenticated;
grant execute on function public.sign_contract(
  uuid, text, text, uuid, text, text, text
) to authenticated;
grant execute on function public.decline_contract(uuid, text, text)
  to authenticated;
grant execute on function public.void_contract(uuid, text) to authenticated;
grant execute on function public.contract_audit_trail(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Reserved for the trusted server layer and the scheduled jobs
-- -----------------------------------------------------------------------------

revoke all on function public.register_file(
  uuid, text, text, text, bigint, text, text, uuid, text
) from anon, authenticated;
revoke all on function public.archive_cold_files(integer, integer)
  from anon, authenticated;
revoke all on function public.orphaned_files(integer, integer)
  from anon, authenticated;
revoke all on function public.expire_stale_upload_sessions()
  from anon, authenticated;
revoke all on function public.expire_stale_contracts() from anon, authenticated;
revoke all on function public.seal_contract(uuid, uuid, text)
  from anon, authenticated;
