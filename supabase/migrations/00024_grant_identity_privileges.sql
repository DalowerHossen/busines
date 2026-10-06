-- supabase/migrations/00024_grant_identity_privileges.sql
-- Table privileges for the API roles.
--
-- Row level security decides which rows a caller may touch; these grants decide
-- which statements are available at all. The two layers together form the
-- access model, and neither is sufficient on its own.
--
-- No table grants DELETE to a client role: records are removed by setting
-- deleted_at through the soft delete helpers.

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update on public.companies to authenticated;
grant select, insert, update on public.users to authenticated;
grant select, insert, update on public.resellers to authenticated;
grant select, insert, update on public.company_profiles to authenticated;
grant select, insert on public.company_profile_snapshots to authenticated;
grant select, insert, update on public.accountant_company_access to authenticated;
grant select, insert, update on public.team_invitations to authenticated;
grant select, insert, update, delete on public.user_two_factor to authenticated;
grant select, update on public.user_sessions to authenticated;
grant select on public.login_attempts to authenticated;
grant select, insert on public.user_consents to authenticated;

-- The audit trail is readable only. Entries are appended by trigger functions
-- and by the trusted server layer.
grant select on public.audit_logs to authenticated;

-- Document counters are maintained exclusively by public.next_document_number.
revoke all on public.document_number_counters from anon, authenticated;

-- Helper routines the client layer is allowed to call.
grant execute on function public.capture_company_profile_snapshot(uuid) to authenticated;
grant execute on function public.record_manual_audit_entry(
  public.audit_action, text, uuid, uuid, text, jsonb
) to authenticated;
grant execute on function public.current_user_id() to anon, authenticated;
grant execute on function public.current_user_role() to anon, authenticated;
grant execute on function public.current_company_id() to anon, authenticated;
grant execute on function public.has_company_access(uuid) to anon, authenticated;
grant execute on function public.can_write_company_data(uuid) to anon, authenticated;
grant execute on function public.has_permission(text, public.permission_action)
  to anon, authenticated;

-- Maintenance routines belong to scheduled jobs running as the service role.
revoke all on function public.expire_stale_invitations() from anon, authenticated;
revoke all on function public.expire_stale_access_grants() from anon, authenticated;
revoke all on function public.purge_deleted_records(text, integer, text) from anon, authenticated;
