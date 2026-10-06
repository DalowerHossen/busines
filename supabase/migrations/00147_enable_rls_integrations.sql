-- supabase/migrations/00147_enable_rls_integrations.sql
-- Row level security for the credential vault.
--
-- The catalogue is public knowledge: anyone signed in may read which services
-- can be connected. A credential is not. A tenant sees its own connections
-- and nothing of the platform's, and the ciphertext itself is kept out of
-- reach by the column grants in the next migration rather than by a policy,
-- because a column grant cannot be argued with.

alter table public.integration_providers enable row level security;
alter table public.integration_credentials enable row level security;
alter table public.integration_connection_tests enable row level security;
alter table public.integration_usage_events enable row level security;
alter table public.integration_config_stamp enable row level security;

alter table public.integration_providers force row level security;
alter table public.integration_credentials force row level security;
alter table public.integration_connection_tests force row level security;
alter table public.integration_usage_events force row level security;
alter table public.integration_config_stamp force row level security;

-- -----------------------------------------------------------------------------
-- The catalogue
-- -----------------------------------------------------------------------------

create policy integration_providers_select on public.integration_providers
  for select to authenticated
  using (is_active or public.is_super_admin());

-- Adding a provider that nobody wrote code for is a platform decision.
create policy integration_providers_insert on public.integration_providers
  for insert to authenticated
  with check (public.is_super_admin());

create policy integration_providers_update on public.integration_providers
  for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- -----------------------------------------------------------------------------
-- The credentials themselves
-- -----------------------------------------------------------------------------

-- A tenant owner sees the connections of their own tenant. The platform
-- connections are not theirs to see, even though they use them every day.
create policy integration_credentials_select on public.integration_credentials
  for select to authenticated
  using (
    deleted_at is null
    and (
      (company_id is not null
       and (public.is_company_owner(company_id) or public.is_super_admin()))
      or (company_id is null and public.is_super_admin())
    )
  );

create policy integration_credentials_insert on public.integration_credentials
  for insert to authenticated
  with check (
    (company_id is not null
     and (public.is_company_owner(company_id) or public.is_super_admin()))
    or (company_id is null and public.is_super_admin())
  );

create policy integration_credentials_update on public.integration_credentials
  for update to authenticated
  using (
    deleted_at is null
    and (
      (company_id is not null
       and (public.is_company_owner(company_id) or public.is_super_admin()))
      or (company_id is null and public.is_super_admin())
    )
  )
  with check (
    (company_id is not null
     and (public.is_company_owner(company_id) or public.is_super_admin()))
    or (company_id is null and public.is_super_admin())
  );

-- -----------------------------------------------------------------------------
-- Tests and usage
-- -----------------------------------------------------------------------------

create policy integration_tests_select on public.integration_connection_tests
  for select to authenticated
  using (
    (company_id is not null
     and (public.is_company_owner(company_id) or public.is_super_admin()))
    or (company_id is null and public.is_super_admin())
  );

create policy integration_usage_select on public.integration_usage_events
  for select to authenticated
  using (
    (company_id is not null
     and (public.is_company_owner(company_id) or public.is_super_admin()))
    or (company_id is null and public.is_super_admin())
  );

-- -----------------------------------------------------------------------------
-- The revision counter
-- -----------------------------------------------------------------------------

-- Everyone may read the counter. It carries no information beyond the fact
-- that something changed, and every running instance needs it.
create policy integration_config_stamp_select on public.integration_config_stamp
  for select to authenticated
  using (true);
