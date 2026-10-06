-- supabase/migrations/00124_enable_rls_storage.sql
-- Row level security for files, uploads and contracts.
--
-- Two rules shape this file. Platform assets belong to nobody and are
-- readable by every signed in user; tenant files belong to exactly one
-- tenant and are invisible to everyone else. The read trail is never
-- editable by the people it records.

alter table public.storage_targets enable row level security;
alter table public.files enable row level security;
alter table public.file_variants enable row level security;
alter table public.file_access_logs enable row level security;
alter table public.upload_sessions enable row level security;
alter table public.storage_quotas enable row level security;
alter table public.contracts enable row level security;
alter table public.contract_templates enable row level security;
alter table public.contract_signers enable row level security;
alter table public.contract_events enable row level security;

alter table public.storage_targets force row level security;
alter table public.files force row level security;
alter table public.file_variants force row level security;
alter table public.file_access_logs force row level security;
alter table public.upload_sessions force row level security;
alter table public.storage_quotas force row level security;
alter table public.contracts force row level security;
alter table public.contract_templates force row level security;
alter table public.contract_signers force row level security;
alter table public.contract_events force row level security;

select public.install_tenant_policies('contracts');

-- -----------------------------------------------------------------------------
-- Where files live
-- -----------------------------------------------------------------------------

-- A tenant may see the platform target it writes to and its own, but never
-- another tenant configuration.
create policy storage_targets_select on public.storage_targets
  for select to authenticated
  using (
    deleted_at is null
    and (company_id is null or public.has_company_access(company_id))
  );

-- Bringing your own bucket is an owner decision, like opening a bank account.
create policy storage_targets_insert on public.storage_targets
  for insert to authenticated
  with check (
    company_id is not null
    and (public.is_company_owner(company_id) or public.is_super_admin())
  );

create policy storage_targets_update on public.storage_targets
  for update to authenticated
  using (
    deleted_at is null
    and company_id is not null
    and (public.is_company_owner(company_id) or public.is_super_admin())
  )
  with check (
    company_id is not null
    and (public.is_company_owner(company_id) or public.is_super_admin())
  );

comment on policy storage_targets_insert on public.storage_targets is
  'Only the account owner may point the tenant at its own bucket.';

-- -----------------------------------------------------------------------------
-- Files
-- -----------------------------------------------------------------------------

create policy files_select on public.files
  for select to authenticated
  using (
    deleted_at is null
    and (company_id is null or public.has_company_access(company_id))
  );

create policy files_insert on public.files
  for insert to authenticated
  with check (
    company_id is not null and public.can_write_company_data(company_id)
  );

create policy files_update on public.files
  for update to authenticated
  using (deleted_at is null and public.can_write_company_data(company_id))
  with check (public.can_write_company_data(company_id));

create policy file_variants_select on public.file_variants
  for select to authenticated
  using (company_id is null or public.has_company_access(company_id));

create policy file_variants_insert on public.file_variants
  for insert to authenticated
  with check (
    company_id is not null and public.can_write_company_data(company_id)
  );

-- The read trail is readable by the owner of the data and written by the
-- platform. Nobody can change it afterwards.
create policy file_access_logs_select on public.file_access_logs
  for select to authenticated
  using (
    public.is_super_admin()
    or (company_id is not null and public.is_company_owner(company_id))
  );

create policy file_access_logs_insert on public.file_access_logs
  for insert to authenticated
  with check (company_id is null or public.has_company_access(company_id));

comment on policy file_access_logs_select on public.file_access_logs is
  'The read trail of sensitive documents is for the account owner.';

create policy upload_sessions_select on public.upload_sessions
  for select to authenticated
  using (company_id is null or public.has_company_access(company_id));

create policy upload_sessions_insert on public.upload_sessions
  for insert to authenticated
  with check (
    company_id is not null and public.can_write_company_data(company_id)
  );

create policy upload_sessions_update on public.upload_sessions
  for update to authenticated
  using (public.can_write_company_data(company_id))
  with check (public.can_write_company_data(company_id));

create policy storage_quotas_select on public.storage_quotas
  for select to authenticated
  using (public.has_company_access(company_id));

-- -----------------------------------------------------------------------------
-- Contracts
-- -----------------------------------------------------------------------------

-- Platform wording is readable by everyone and editable only by the platform.
create policy contract_templates_select on public.contract_templates
  for select to authenticated
  using (
    deleted_at is null
    and (company_id is null or public.has_company_access(company_id))
  );

create policy contract_templates_insert on public.contract_templates
  for insert to authenticated
  with check (
    (company_id is not null and public.can_write_company_data(company_id))
    or public.is_super_admin()
  );

create policy contract_templates_update on public.contract_templates
  for update to authenticated
  using (
    deleted_at is null
    and ((company_id is not null and public.can_write_company_data(company_id))
         or public.is_super_admin())
  )
  with check (
    (company_id is not null and public.can_write_company_data(company_id))
    or public.is_super_admin()
  );

create policy contract_signers_select on public.contract_signers
  for select to authenticated
  using (public.has_company_access(company_id));

create policy contract_signers_insert on public.contract_signers
  for insert to authenticated
  with check (public.can_write_company_data(company_id));

create policy contract_signers_update on public.contract_signers
  for update to authenticated
  using (public.can_write_company_data(company_id))
  with check (public.can_write_company_data(company_id));

create policy contract_events_select on public.contract_events
  for select to authenticated
  using (public.has_company_access(company_id));

create policy contract_events_insert on public.contract_events
  for insert to authenticated
  with check (public.has_company_access(company_id));

comment on policy contract_events_insert on public.contract_events is
  'The trail is written as things happen and never rewritten afterwards.';
