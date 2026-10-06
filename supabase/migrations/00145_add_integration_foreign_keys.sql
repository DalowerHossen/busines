-- supabase/migrations/00145_add_integration_foreign_keys.sql
-- The relationships of the credential vault.
--
-- A credential points at a provider in the catalogue by key rather than by
-- identifier, so a custom provider added by an administrator behaves exactly
-- like a built in one. The test and usage history keeps its rows when the
-- credential behind it is removed, because that history is the explanation
-- of what happened.

alter table public.integration_credentials
  add constraint integration_credentials_provider_fk
    foreign key (provider_key)
    references public.integration_providers (provider_key)
    on update cascade,
  add constraint integration_credentials_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint integration_credentials_rotated_by_fk
    foreign key (rotated_by) references public.users (id) on delete set null,
  add constraint integration_credentials_created_by_fk
    foreign key (created_by) references public.users (id) on delete set null,
  add constraint integration_credentials_updated_by_fk
    foreign key (updated_by) references public.users (id) on delete set null;

alter table public.integration_connection_tests
  add constraint integration_tests_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint integration_tests_credential_fk
    foreign key (credential_id) references public.integration_credentials (id)
      on delete set null,
  add constraint integration_tests_provider_fk
    foreign key (provider_key)
    references public.integration_providers (provider_key)
    on update cascade,
  add constraint integration_tests_tested_by_fk
    foreign key (tested_by) references public.users (id) on delete set null;

alter table public.integration_usage_events
  add constraint integration_usage_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint integration_usage_credential_fk
    foreign key (credential_id) references public.integration_credentials (id)
      on delete set null,
  add constraint integration_usage_provider_fk
    foreign key (provider_key)
    references public.integration_providers (provider_key)
    on update cascade;
