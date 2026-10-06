-- supabase/migrations/00138_enable_rls_platform.sql
-- Row level security for keys, traffic, webhooks, jobs and governance.
--
-- Three rules shape this file. An API key digest is never readable by anyone,
-- so the table is readable only through its metadata columns and the secret
-- column is protected by the grant file next to this one. Operational history
-- is readable by the tenant it belongs to and by nobody else. Platform wide
-- configuration is written only by the platform team.

alter table public.api_keys enable row level security;
alter table public.api_request_logs enable row level security;
alter table public.rate_limit_counters enable row level security;
alter table public.webhook_endpoints enable row level security;
alter table public.outbound_events enable row level security;
alter table public.webhook_deliveries enable row level security;
alter table public.background_jobs enable row level security;
alter table public.job_schedules enable row level security;
alter table public.platform_settings enable row level security;
alter table public.feature_flags enable row level security;
alter table public.tenant_security_policies enable row level security;
alter table public.approval_requests enable row level security;
alter table public.approval_decisions enable row level security;
alter table public.sensitive_access_logs enable row level security;

alter table public.api_keys force row level security;
alter table public.api_request_logs force row level security;
alter table public.rate_limit_counters force row level security;
alter table public.webhook_endpoints force row level security;
alter table public.outbound_events force row level security;
alter table public.webhook_deliveries force row level security;
alter table public.background_jobs force row level security;
alter table public.job_schedules force row level security;
alter table public.platform_settings force row level security;
alter table public.feature_flags force row level security;
alter table public.tenant_security_policies force row level security;
alter table public.approval_requests force row level security;
alter table public.approval_decisions force row level security;
alter table public.sensitive_access_logs force row level security;

-- -----------------------------------------------------------------------------
-- API keys
-- -----------------------------------------------------------------------------

-- Issuing credentials that can move money is an owner decision.
create policy api_keys_select on public.api_keys
  for select to authenticated
  using (deleted_at is null and public.has_company_access(company_id));

create policy api_keys_insert on public.api_keys
  for insert to authenticated
  with check (public.is_company_owner(company_id) or public.is_super_admin());

create policy api_keys_update on public.api_keys
  for update to authenticated
  using (
    deleted_at is null
    and (public.is_company_owner(company_id) or public.is_super_admin())
  )
  with check (public.is_company_owner(company_id) or public.is_super_admin());

-- -----------------------------------------------------------------------------
-- Traffic
-- -----------------------------------------------------------------------------

-- A tenant can read what its own keys did. Nobody writes this table by hand;
-- the recording routine owns it.
create policy api_request_logs_select on public.api_request_logs
  for select to authenticated
  using (company_id is not null and public.has_company_access(company_id));

-- Counters are an internal mechanism with no tenant column, so they stay
-- invisible to every signed in caller and are reached only through the
-- consume and status routines.
create policy rate_limit_counters_no_access on public.rate_limit_counters
  for select to authenticated
  using (false);

-- -----------------------------------------------------------------------------
-- Outbound webhooks
-- -----------------------------------------------------------------------------

create policy webhook_endpoints_select on public.webhook_endpoints
  for select to authenticated
  using (deleted_at is null and public.has_company_access(company_id));

create policy webhook_endpoints_insert on public.webhook_endpoints
  for insert to authenticated
  with check (public.is_company_owner(company_id) or public.is_super_admin());

create policy webhook_endpoints_update on public.webhook_endpoints
  for update to authenticated
  using (
    deleted_at is null
    and (public.is_company_owner(company_id) or public.is_super_admin())
  )
  with check (public.is_company_owner(company_id) or public.is_super_admin());

create policy outbound_events_select on public.outbound_events
  for select to authenticated
  using (public.has_company_access(company_id));

create policy webhook_deliveries_select on public.webhook_deliveries
  for select to authenticated
  using (public.has_company_access(company_id));

-- -----------------------------------------------------------------------------
-- Background work
-- -----------------------------------------------------------------------------

-- A tenant sees its own jobs and the platform jobs that affect it only as far
-- as the platform team allows, which is to say the shared ones stay hidden.
create policy background_jobs_select on public.background_jobs
  for select to authenticated
  using (
    (company_id is not null and public.has_company_access(company_id))
    or public.is_super_admin()
  );

create policy job_schedules_select on public.job_schedules
  for select to authenticated
  using (
    (company_id is not null and public.has_company_access(company_id))
    or public.is_super_admin()
  );

create policy job_schedules_insert on public.job_schedules
  for insert to authenticated
  with check (
    company_id is not null
    and (public.is_company_owner(company_id) or public.is_super_admin())
  );

create policy job_schedules_update on public.job_schedules
  for update to authenticated
  using (
    company_id is not null
    and (public.is_company_owner(company_id) or public.is_super_admin())
  )
  with check (
    company_id is not null
    and (public.is_company_owner(company_id) or public.is_super_admin())
  );

-- -----------------------------------------------------------------------------
-- Platform configuration
-- -----------------------------------------------------------------------------

-- Anyone signed in may read the handful of settings marked public, such as the
-- brand name. A secret setting is never selectable, whoever is asking.
create policy platform_settings_select on public.platform_settings
  for select to authenticated
  using ((is_public and not is_secret) or public.is_super_admin());

create policy platform_settings_write on public.platform_settings
  for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy feature_flags_select on public.feature_flags
  for select to authenticated
  using (true);

create policy feature_flags_insert on public.feature_flags
  for insert to authenticated
  with check (public.is_super_admin());

create policy feature_flags_update on public.feature_flags
  for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- -----------------------------------------------------------------------------
-- Tenant security policy
-- -----------------------------------------------------------------------------

-- Everyone in the tenant can read the rules they are held to; only the owner
-- can change them.
create policy tenant_security_policies_select on public.tenant_security_policies
  for select to authenticated
  using (public.has_company_access(company_id));

create policy tenant_security_policies_update on public.tenant_security_policies
  for update to authenticated
  using (public.is_company_owner(company_id) or public.is_super_admin())
  with check (public.is_company_owner(company_id) or public.is_super_admin());

-- -----------------------------------------------------------------------------
-- Approvals and sensitive reads
-- -----------------------------------------------------------------------------

select public.install_tenant_policies('approval_requests');

create policy approval_decisions_select on public.approval_decisions
  for select to authenticated
  using (public.has_company_access(company_id));

-- The owner and the platform team can see who read what. A staff member
-- cannot audit the audit.
create policy sensitive_access_logs_select on public.sensitive_access_logs
  for select to authenticated
  using (
    company_id is not null
    and (public.is_company_owner(company_id) or public.is_super_admin())
  );
