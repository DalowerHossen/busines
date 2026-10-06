-- supabase/migrations/00136_add_platform_foreign_keys.sql
-- The relationships of the platform operations tables.
--
-- Operational history is evidence. Logs and delivery records keep their rows
-- when the key or endpoint behind them is removed, so a tenant can still show
-- what happened; only the live configuration cascades away.

alter table public.api_keys
  add constraint api_keys_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint api_keys_revoked_by_fk
    foreign key (revoked_by) references public.users (id) on delete set null,
  add constraint api_keys_created_by_fk
    foreign key (created_by) references public.users (id) on delete set null,
  add constraint api_keys_updated_by_fk
    foreign key (updated_by) references public.users (id) on delete set null;

alter table public.api_request_logs
  add constraint api_request_logs_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint api_request_logs_api_key_fk
    foreign key (api_key_id) references public.api_keys (id) on delete set null;

alter table public.webhook_endpoints
  add constraint webhook_endpoints_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint webhook_endpoints_created_by_fk
    foreign key (created_by) references public.users (id) on delete set null,
  add constraint webhook_endpoints_updated_by_fk
    foreign key (updated_by) references public.users (id) on delete set null;

alter table public.outbound_events
  add constraint outbound_events_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade;

alter table public.webhook_deliveries
  add constraint webhook_deliveries_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint webhook_deliveries_endpoint_fk
    foreign key (endpoint_id) references public.webhook_endpoints (id)
      on delete cascade,
  add constraint webhook_deliveries_event_fk
    foreign key (event_id) references public.outbound_events (id)
      on delete cascade;

alter table public.background_jobs
  add constraint background_jobs_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint background_jobs_schedule_fk
    foreign key (schedule_id) references public.job_schedules (id)
      on delete set null,
  add constraint background_jobs_created_by_fk
    foreign key (created_by) references public.users (id) on delete set null;

alter table public.job_schedules
  add constraint job_schedules_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint job_schedules_created_by_fk
    foreign key (created_by) references public.users (id) on delete set null,
  add constraint job_schedules_updated_by_fk
    foreign key (updated_by) references public.users (id) on delete set null;

alter table public.platform_settings
  add constraint platform_settings_updated_by_fk
    foreign key (updated_by) references public.users (id) on delete set null;

alter table public.feature_flags
  add constraint feature_flags_created_by_fk
    foreign key (created_by) references public.users (id) on delete set null,
  add constraint feature_flags_updated_by_fk
    foreign key (updated_by) references public.users (id) on delete set null;

alter table public.tenant_security_policies
  add constraint tenant_security_policies_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint tenant_security_policies_updated_by_fk
    foreign key (updated_by) references public.users (id) on delete set null;

alter table public.approval_requests
  add constraint approval_requests_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint approval_requests_requested_by_fk
    foreign key (requested_by) references public.users (id),
  add constraint approval_requests_decided_by_fk
    foreign key (decided_by) references public.users (id) on delete set null;

alter table public.approval_decisions
  add constraint approval_decisions_company_fk
    foreign key (company_id) references public.companies (id) on delete cascade,
  add constraint approval_decisions_request_fk
    foreign key (approval_request_id) references public.approval_requests (id)
      on delete cascade,
  add constraint approval_decisions_decided_by_fk
    foreign key (decided_by) references public.users (id);

-- The read register keeps its rows even when the tenant is removed.
alter table public.sensitive_access_logs
  add constraint sensitive_access_logs_company_fk
    foreign key (company_id) references public.companies (id) on delete set null,
  add constraint sensitive_access_logs_accessed_by_fk
    foreign key (accessed_by) references public.users (id) on delete set null;
