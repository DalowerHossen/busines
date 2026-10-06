-- supabase/migrations/00122_add_storage_foreign_keys.sql
-- The relationships of the storage and contract tables.
--
-- File rows outlive the records they were attached to in several places, so
-- the links that are evidence are kept with set null rather than cascade.

alter table public.storage_targets
  add constraint storage_targets_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint storage_targets_created_by_fk
    foreign key (created_by) references public.users (id) on delete set null,
  add constraint storage_targets_updated_by_fk
    foreign key (updated_by) references public.users (id) on delete set null;

alter table public.files
  add constraint files_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint files_storage_target_fk
    foreign key (storage_target_id) references public.storage_targets (id),
  add constraint files_replaces_fk
    foreign key (replaces_file_id) references public.files (id) on delete set null,
  add constraint files_created_by_fk
    foreign key (created_by) references public.users (id) on delete set null,
  add constraint files_updated_by_fk
    foreign key (updated_by) references public.users (id) on delete set null;

alter table public.file_variants
  add constraint file_variants_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint file_variants_file_fk
    foreign key (file_id) references public.files (id) on delete cascade;

alter table public.file_access_logs
  add constraint file_access_logs_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint file_access_logs_file_fk
    foreign key (file_id) references public.files (id) on delete cascade,
  add constraint file_access_logs_actor_fk
    foreign key (actor_user_id) references public.users (id) on delete set null,
  add constraint file_access_logs_link_fk
    foreign key (document_link_id) references public.document_links (id)
      on delete set null;

alter table public.upload_sessions
  add constraint upload_sessions_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint upload_sessions_target_fk
    foreign key (storage_target_id) references public.storage_targets (id),
  add constraint upload_sessions_file_fk
    foreign key (file_id) references public.files (id) on delete set null,
  add constraint upload_sessions_requested_by_fk
    foreign key (requested_by) references public.users (id) on delete set null;

alter table public.storage_quotas
  add constraint storage_quotas_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade;

-- -----------------------------------------------------------------------------
-- Contracts
-- -----------------------------------------------------------------------------

alter table public.contracts
  add constraint contracts_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint contracts_client_fk
    foreign key (client_id) references public.clients (id),
  add constraint contracts_project_fk
    foreign key (project_id) references public.projects (id) on delete set null,
  add constraint contracts_template_fk
    foreign key (template_id) references public.contract_templates (id)
      on delete set null,
  add constraint contracts_invoice_fk
    foreign key (invoice_id) references public.invoices (id) on delete set null,
  add constraint contracts_sealed_file_fk
    foreign key (sealed_file_id) references public.files (id) on delete set null,
  add constraint contracts_created_by_fk
    foreign key (created_by) references public.users (id) on delete set null,
  add constraint contracts_updated_by_fk
    foreign key (updated_by) references public.users (id) on delete set null;

alter table public.contract_templates
  add constraint contract_templates_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint contract_templates_created_by_fk
    foreign key (created_by) references public.users (id) on delete set null,
  add constraint contract_templates_updated_by_fk
    foreign key (updated_by) references public.users (id) on delete set null;

alter table public.contract_signers
  add constraint contract_signers_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint contract_signers_contract_fk
    foreign key (contract_id) references public.contracts (id) on delete cascade,
  add constraint contract_signers_link_fk
    foreign key (document_link_id) references public.document_links (id)
      on delete set null,
  add constraint contract_signers_signature_file_fk
    foreign key (signature_image_file_id) references public.files (id)
      on delete set null;

alter table public.contract_events
  add constraint contract_events_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint contract_events_contract_fk
    foreign key (contract_id) references public.contracts (id) on delete cascade,
  add constraint contract_events_signer_fk
    foreign key (signer_id) references public.contract_signers (id)
      on delete set null,
  add constraint contract_events_actor_fk
    foreign key (actor_user_id) references public.users (id) on delete set null;
